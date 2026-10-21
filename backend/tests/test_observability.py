"""Request IDs, structured access logs and unhandled-error reporting."""

import json
import logging
import re

from app.core.config import Settings
from app.core.logging import JsonFormatter, configure_logging


def test_every_response_carries_a_request_id(client):
    rid = client.get("/api/health").headers["x-request-id"]
    assert re.fullmatch(r"[0-9a-f]{32}", rid)
    assert client.get("/api/health").headers["x-request-id"] != rid


def test_a_safe_incoming_request_id_is_kept_and_an_unsafe_one_replaced(client):
    assert client.get("/api/health", headers={"X-Request-ID": "edge-abc.123"}).headers["x-request-id"] == "edge-abc.123"
    for bad in ["has space", "x" * 65, "<script>"]:
        assert client.get("/api/health", headers={"X-Request-ID": bad}).headers["x-request-id"] != bad


def test_access_log_line_per_request(client, caplog):
    caplog.set_level(logging.INFO, logger="haru")
    res = client.get("/api/room", params={"q": "secret-search"})
    [rec] = [r for r in caplog.records if r.name == "haru.access"]
    assert (rec.method, rec.path, rec.status) == ("GET", "/api/room", 200)
    assert rec.request_id == res.headers["x-request-id"]
    assert rec.duration_ms >= 0
    assert "secret-search" not in rec.getMessage() + rec.path  # query strings (search terms, PII) stay out


def test_unhandled_error_is_a_json_500_with_the_request_id_and_is_logged(client, caplog, monkeypatch):
    from app.services import reservations as svc
    monkeypatch.setattr(svc, "load_settings", lambda db: (_ for _ in ()).throw(RuntimeError("kaboom")))
    caplog.set_level(logging.INFO, logger="haru")
    res = client.get("/api/room")
    assert res.status_code == 500
    rid = res.headers["x-request-id"]
    assert res.json() == {"detail": "INTERNAL_ERROR", "request_id": rid}
    assert res.headers["x-content-type-options"] == "nosniff"  # security headers still applied
    [err] = [r for r in caplog.records if r.levelno == logging.ERROR]
    assert err.request_id == rid and err.exc_info and "kaboom" in str(err.exc_info[1])
    assert "kaboom" not in res.text  # internals never reach the client


def test_json_formatter_emits_one_object_per_line():
    rec = logging.LogRecord("haru.access", logging.INFO, __file__, 1, "request", None, None)
    rec.request_id, rec.status = "abc", 200
    out = json.loads(JsonFormatter().format(rec))
    assert out["level"] == "INFO" and out["logger"] == "haru.access" and out["msg"] == "request"
    assert out["request_id"] == "abc" and out["status"] == 200 and "ts" in out


def test_prod_logs_json_by_default():
    assert isinstance(configure_logging(Settings(environment="prod", jwt_secret="x" * 48)).formatter, JsonFormatter)
    assert not isinstance(configure_logging(Settings()).formatter, JsonFormatter)
