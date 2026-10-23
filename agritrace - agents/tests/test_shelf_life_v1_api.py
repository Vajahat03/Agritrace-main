import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app
from backend.security import AuthStore, get_auth_store
from data_pipeline.shelf_life_training.shelf_life_xgboost_v1.predict import predict


@pytest.fixture
def api():
    store = AuthStore(database_path=":memory:")
    app.dependency_overrides[get_auth_store] = lambda: store
    with TestClient(app) as client:
        registered = client.post("/auth/register", json={
            "full_name": "Shelf Life User", "email": "shelf@example.test",
            "phone": "+919876543210", "password": "correct horse battery staple",
            "role": "farmer", "workspace_name": "Shelf Workspace",
        })
        assert registered.status_code == 201
        yield client, store
    app.dependency_overrides.clear()


@pytest.fixture
def valid_input():
    return {
        "produce_type": "Tomato", "freshness_score": 75,
        "quality_score": 75, "defect_probability": 0.3,
        "temperature_c": 10, "humidity_rh": 80,
        "harvest_age_days": 3, "storage_type": "Refrigerated",
    }


def test_authenticated_api_uses_saved_v1_artifact_and_persists_metadata(api, valid_input):
    client, store = api
    response = client.post("/api/shelf-life/predict", json=valid_input)
    assert response.status_code == 200
    result = response.json()
    expected = predict(**valid_input)
    assert result["predicted_days"] == expected
    assert result["model_name"] == "shelf_life_xgboost_v1"
    assert result["development_only"] is True
    assert result["real_world_validated"] is False
    assert result["input_provenance"]["freshness_score"] == "explicit_development_model_input"
    with store.connect() as db:
        row = db.execute("SELECT predicted_days,development_only,real_world_validated FROM shelf_life_predictions WHERE id=?",
                         (result["prediction_id"],)).fetchone()
    assert row["predicted_days"] == expected
    assert row["development_only"] == 1 and row["real_world_validated"] == 0


def test_shelf_life_requires_auth_and_all_v1_inputs(api, valid_input):
    client, _ = api
    unauthenticated = TestClient(app)
    assert unauthenticated.post("/api/shelf-life/predict", json=valid_input).status_code == 401
    incomplete = dict(valid_input)
    del incomplete["freshness_score"]
    assert client.post("/api/shelf-life/predict", json=incomplete).status_code == 422
    assert client.post("/api/shelf-life/predict", json=valid_input | {"storage_type": "ambient"}).status_code == 422
    assert client.post("/api/shelf-life/predict", json=valid_input | {"freshness_score": 14}).status_code == 422
    unauthenticated.close()
