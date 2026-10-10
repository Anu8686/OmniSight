import pytest

from app.ai.schemas import Finding
from app.security.css_guard import UnsafeCssError, validate_css_patch
from app.security.url_guard import UnsafeTargetError, is_url_allowed, validate_target_url
from app.core.logging import mask_secrets


@pytest.mark.parametrize("url", [
    "http://169.254.169.254/", "http://metadata.google.internal/", "http://127.0.0.1/", "http://localhost/",
    "http://10.1.2.3/", "http://172.16.0.1/", "http://192.168.0.10/", "http://[::1]/", "http://[::ffff:127.0.0.1]/",
    "http://0.0.0.0/", "javascript:alert(1)", "file:///etc/passwd", "http://user:pass@example.com/", "", "http://",
    "http://printer.local/", "http://db.internal/",
])
def test_blocked_targets(url):
    with pytest.raises(UnsafeTargetError):
        validate_target_url(url)


def test_allowlisted_demo_host_is_authorised():
    t = validate_target_url("http://127.0.0.1:5050/index.html")
    assert t.explicitly_allowed
    with pytest.raises(UnsafeTargetError):  # same host, different (non-listed) port
        validate_target_url("http://127.0.0.1:5051/")


def test_public_ip_literal_allowed_without_dns():
    assert not validate_target_url("http://93.184.216.34/").explicitly_allowed


def test_browser_request_guard_blocks_redirect_to_internal():
    assert not is_url_allowed("http://169.254.169.254/latest")
    assert not is_url_allowed("http://127.0.0.1:9/")
    assert is_url_allowed("http://127.0.0.1:5050/styles.css")
    assert is_url_allowed("data:text/plain,hi")


GOOD_CSS = ".a.a.a { max-width: 100%; box-sizing: border-box; }"


def test_css_guard_accepts_scoped_rules_and_media():
    assert validate_css_patch(GOOD_CSS)
    assert validate_css_patch("@media (max-width: 480px) { .b.b.b { max-width: 100%; } .c { margin-top: 0; } }")
    assert validate_css_patch("@media (min-width: 768px) { ul.nav-links { flex-wrap: nowrap; max-width: none; } }")


@pytest.mark.parametrize("css", [
    "", "@import url(http://evil.test/x.css);", ".a { background: url(http://evil.test/p.png); }", ".a { behavior: x; }",
    ".a { color: red; } </style><script>alert(1)</script>", "@font-face { font-family: x; }", ".a { content: 'x'; }",
    ".a { margin-top: 0;", ".a { margin-top: 0; } /* hi */", "@media screen { .a { margin: 0; } }", "@supports (x:y) { .a { margin: 0; } }",
    "x" * 5000, ".a { position: absolute; top: expression(alert(1)); }", ".a\\b { margin: 0; }",
])
def test_css_guard_rejects_unsafe(css):
    with pytest.raises(UnsafeCssError):
        validate_css_patch(css)


def test_secret_masking():
    s = mask_secrets("token ghp_abcdefghijklmnopqrstuvwxyz0123456789 and api_key=sk-abcdefghijklmnopqrstuv and Authorization: Bearer abc.def.ghi")
    assert "ghp_" not in s and "sk-abc" not in s and "abc.def.ghi" not in s


def test_finding_schema_is_strict():
    ok = {"title": "Checkout button clipped", "category": "responsive-layout", "severity": "critical", "description": "The button is clipped.",
          "viewport": "mobile", "confidence": 0.9}
    assert Finding.model_validate(ok)
    for bad in ({**ok, "severity": "apocalyptic"}, {**ok, "confidence": 1.5}, {**ok, "extra": 1}, {**ok, "viewport": "watch"},
                {k: v for k, v in ok.items() if k != "title"}):
        with pytest.raises(Exception):
            Finding.model_validate(bad)
