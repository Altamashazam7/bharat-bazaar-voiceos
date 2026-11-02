import json
from pathlib import Path

from backend.app.services import evaluation


def test_evaluation_reports_cart_match_and_failure(tmp_path, monkeypatch):
    truth_path = tmp_path / "ground_truth.json"
    samples_path = tmp_path / "samples"
    samples_path.mkdir()
    truth = {
        "order1.m4a": {"Maggi": 2},
        "order2.m4a": {"Tata Salt": 1},
    }
    truth_path.write_text(json.dumps(truth), encoding="utf-8")
    for filename in truth:
        (samples_path / filename).touch()

    def fake_process_audio(
        audio_path,
        include_audio,
        record_order,
        deduct_inventory,
    ):
        assert include_audio is False
        assert record_order is False
        assert deduct_inventory is False
        if Path(audio_path).name == "order1.m4a":
            return {"cart": {"Maggi": 2}, "transcript": "two maggi"}
        return {"cart": {"Tata Salt": 2}, "transcript": "two tata salt"}

    monkeypatch.setattr(evaluation, "GROUND_TRUTH_PATH", truth_path)
    monkeypatch.setattr(evaluation, "SAMPLES_PATH", samples_path)
    monkeypatch.setattr(evaluation, "process_audio", fake_process_audio)

    report = evaluation.evaluate_dataset()

    assert report["total_samples"] == 2
    assert report["passed"] == 1
    assert report["failed"] == 1
    assert report["accuracy"] == 50.0
    assert [row["status"] for row in report["results"]] == ["passed", "failed"]


def test_evaluation_reports_missing_audio_as_error(tmp_path, monkeypatch):
    truth_path = tmp_path / "ground_truth.json"
    truth_path.write_text(
        json.dumps({"missing.m4a": {"Maggi": 1}}),
        encoding="utf-8",
    )
    samples_path = tmp_path / "samples"
    samples_path.mkdir()
    monkeypatch.setattr(evaluation, "GROUND_TRUTH_PATH", truth_path)
    monkeypatch.setattr(evaluation, "SAMPLES_PATH", samples_path)

    report = evaluation.evaluate_dataset()

    assert report["total_samples"] == 1
    assert report["passed"] == 0
    assert report["failed"] == 1
    assert report["accuracy"] == 0
    assert report["results"][0]["status"] == "error"
    assert report["results"][0]["error"] == "Benchmark audio file is missing."


def test_catalog_contains_fifty_plus_products_and_requested_variants():
    catalog_path = Path(__file__).resolve().parents[1] / "catalog" / "products.json"
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    aliases = {
        alias
        for product in catalog
        for alias in product["aliases"]
    }

    assert len(catalog) >= 50
    assert len({product["id"] for product in catalog}) == len(catalog)
    assert {"maggie", "parle ji", "parleji", "tata namak", "ashirvad ata"} <= aliases
