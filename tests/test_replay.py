from backend.app.services.session import OrderSession


def test_replay_flow():
    session = OrderSession()

    session.handle("5 packet amul butter")
    session.handle("2 packet parle g")
    result = session.handle("actually 4 packet amul butter")

    assert result["Amul Butter"] == 4
    assert result["Parle G"] == 2
