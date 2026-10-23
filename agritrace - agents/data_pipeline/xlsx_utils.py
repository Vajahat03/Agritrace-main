"""Minimal XLSX reader used when optional Excel engines are unavailable."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List
from zipfile import ZipFile
from xml.etree import ElementTree

NS = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def _column_index(reference: str) -> int:
    letters = "".join(character for character in reference if character.isalpha())
    index = 0
    for character in letters:
        index = index * 26 + ord(character.upper()) - 64
    return index - 1


def read_xlsx_sheets(path: Path) -> Dict[str, List[List[str]]]:
    with ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("main:si", NS):
                shared.append("".join(node.text or "" for node in item.iter() if node.tag.endswith("}t") or node.tag == "t"))
        workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        relationships = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        sheets: Dict[str, List[List[str]]] = {}
        for sheet in workbook.findall("main:sheets/main:sheet", NS):
            name = sheet.attrib["name"]
            relationship_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rel_targets[relationship_id]
            target = target.lstrip("/")
            if not target.startswith("xl/"):
                target = "xl/" + target
            root = ElementTree.fromstring(archive.read(target))
            rows: List[List[str]] = []
            for row in root.findall("main:sheetData/main:row", NS):
                values: Dict[int, str] = {}
                for cell in row.findall("main:c", NS):
                    position = _column_index(cell.attrib.get("r", "A1"))
                    value = cell.find("main:v", NS)
                    text = "" if value is None else (value.text or "")
                    if cell.attrib.get("t") == "s" and text:
                        text = shared[int(text)]
                    values[position] = text
                rows.append([values.get(index, "") for index in range(max(values.keys(), default=-1) + 1)])
            sheets[name] = rows
        return sheets


def sheets_to_records(path: Path) -> Dict[str, List[dict]]:
    result: Dict[str, List[dict]] = {}
    for name, rows in read_xlsx_sheets(path).items():
        if not rows:
            result[name] = []
            continue
        header_row_index = 0
        if len(rows) > 1 and sum(bool(str(value).strip()) for value in rows[0]) <= 1 and sum(bool(str(value).strip()) for value in rows[1]) > 1:
            header_row_index = 1
        headers = [str(value).strip() or f"column_{index}" for index, value in enumerate(rows[header_row_index])]
        result[name] = [dict(zip(headers, row + [""] * (len(headers) - len(row)))) for row in rows[header_row_index + 1:]]
    return result
