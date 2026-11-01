from backend.app.api.main import app


def test_original_and_new_workflow_routes_are_available():
    paths = {route.path for route in app.routes}

    assert "/transcribe-order" in paths
    assert "/demo" in paths
    assert "/evaluate" in paths
