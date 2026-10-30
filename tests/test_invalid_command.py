from backend.app.services.session import OrderSession


def test_ignore_invalid_command():
    session = OrderSession()

    session.handle("5 packet amul butter")
    result = session.handle("actually")

    assert result["Amul Butter"] == 5
    assert len(result) == 1
