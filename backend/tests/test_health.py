def test_root_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "AgriTrace API Gateway"
    assert data["database"]["status"] in ["connected", "disconnected"]
    assert "MongoDB Atlas" in data["database"]["message"]
    assert data["firebase"]["configured"] is True
    assert data["firebase"]["projectId"] == "agritrace-ab141"

def test_api_v1_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["status"] in ["connected", "disconnected"]

def test_api_v1_health_connected_status(client, monkeypatch):
    from app.db.mongodb import mongodb
    monkeypatch.setattr(mongodb, "is_connected", lambda: True)
    async def mock_ping():
        return True, "MongoDB Atlas connection active and responsive"
    monkeypatch.setattr(mongodb, "ping", mock_ping)

    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["status"] == "connected"
    assert "active and responsive" in data["database"]["message"]

def test_api_v1_health_failed_ping_reported_degraded(client, monkeypatch):
    from app.db.mongodb import mongodb
    monkeypatch.setattr(mongodb, "is_connected", lambda: True)
    async def mock_failed_ping():
        return False, "Database ping failed"
    monkeypatch.setattr(mongodb, "ping", mock_failed_ping)

    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["status"] == "degraded"
    assert data["database"]["message"] == "Database ping failed"

def test_openapi_json(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    spec = response.json()
    assert "openapi" in spec
    assert spec["info"]["title"] == "AgriTrace API Gateway"

def test_docs_page(client):
    response = client.get("/docs")
    assert response.status_code == 200
    assert "swagger-ui" in response.text.lower()
