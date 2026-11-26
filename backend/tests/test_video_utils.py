from backend.video_utils import download_youtube_video
from unittest.mock import patch, MagicMock

@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_youtube_video(mock_ytdl, tmp_path):
    # Mock the YoutubeDL context manager and download method
    mock_instance = MagicMock()
    mock_ytdl.return_value.__enter__.return_value = mock_instance
    
    url = "https://www.youtube.com/watch?v=aqz-KE-bpKQ" 
    output_path = tmp_path / "video.mp4"
    
    # Create a dummy file to simulate successful download
    output_path.write_text("dummy video content")
    
    result_path = download_youtube_video(url, str(output_path))
    
    # Verify YoutubeDL was called with correct URL
    mock_instance.download.assert_called_once_with([url])
    assert result_path.exists()


def test_quality_to_format_caps_height():
    from backend.video_utils import quality_to_format
    assert "height<=2160" in quality_to_format("2160p")
    assert "height<=1440" in quality_to_format("1440p")
    assert "height<=1080" in quality_to_format("1080p")
    assert "height<=720" in quality_to_format("720p")
    assert "height<=480" in quality_to_format("480p")


# --- download format selection (H.264 up to 1080p by default) ----------------

import pytest

ALL_LABELS = ["best", "2160p", "1440p", "1080p", "720p", "480p", "weird", "", None]


def _video(fid, height, vcodec, ext="mp4", tbr=1000):
    return {"format_id": fid, "url": f"https://example.com/{fid}", "ext": ext, "vcodec": vcodec, "acodec": "none",
            "height": height, "width": height * 16 // 9, "tbr": tbr, "protocol": "https"}


def _audio(fid, ext="m4a", acodec="mp4a.40.2"):
    return {"format_id": fid, "url": f"https://example.com/{fid}", "ext": ext, "vcodec": "none", "acodec": acodec,
            "abr": 128, "tbr": 128, "protocol": "https"}


def _muxed(fid, height, vcodec="h264", ext="mp4"):
    return {"format_id": fid, "url": f"https://example.com/{fid}", "ext": ext, "vcodec": vcodec, "acodec": "aac",
            "height": height, "width": height * 9 // 16, "tbr": 900, "protocol": "https"}


# What YouTube offers for a 4K upload: H.264 stops at 1080p, AV1/VP9 go higher.
YOUTUBE_4K = [
    _audio("140"), _audio("251", ext="webm", acodec="opus"),
    _video("134", 360, "avc1.4d401e"), _video("136", 720, "avc1.64001f"),
    _video("137", 1080, "avc1.640028", tbr=4000), _video("399", 1080, "av01.0.08M.08", tbr=2000),
    _video("400", 1440, "av01.0.12M.08", tbr=6000), _video("401", 2160, "av01.0.12M.08", tbr=12000),
    _video("313", 2160, "vp9", ext="webm", tbr=14000),
]


def _selected(quality, formats):
    """Run yt-dlp's real format selection for a quality label over fake formats."""
    import yt_dlp
    from backend.video_utils import quality_to_format
    ydl = yt_dlp.YoutubeDL({"format": quality_to_format(quality), "quiet": True, "simulate": True, "no_warnings": True})
    info = {"id": "x", "title": "t", "extractor": "youtube", "webpage_url": "https://example.com", "formats": formats}
    return ydl.process_video_result(info, download=False)["format_id"]


def test_best_means_h264_1080p_not_av1_4k():
    assert _selected("best", YOUTUBE_4K) == "137+140"


def test_unknown_label_behaves_like_best():
    assert _selected("weird", YOUTUBE_4K) == "137+140"
    assert _selected("", YOUTUBE_4K) == "137+140"
    assert _selected(None, YOUTUBE_4K) == "137+140"


def test_higher_resolutions_stay_selectable():
    assert _selected("2160p", YOUTUBE_4K) == "401+140"
    assert _selected("1440p", YOUTUBE_4K) == "400+140"


def test_labels_up_to_1080p_prefer_h264():
    assert _selected("1080p", YOUTUBE_4K) == "137+140"
    assert _selected("720p", YOUTUBE_4K) == "136+140"
    assert _selected("480p", YOUTUBE_4K) == "134+140"


def test_best_falls_back_to_another_codec_when_there_is_no_h264():
    only_av1 = [_audio("140"), _video("399", 1080, "av01.0.08M.08"), _video("401", 2160, "av01.0.12M.08")]
    assert _selected("best", only_av1) == "399+140"


def test_best_still_downloads_when_everything_is_above_1080p():
    only_4k = [_audio("140"), _video("401", 2160, "av01.0.12M.08")]
    assert _selected("best", only_4k) == "401+140"


def test_best_works_for_sites_with_single_file_formats():
    tiktok_like = [_muxed("0", 720), _muxed("1", 1024, vcodec="h265")]
    assert _selected("best", tiktok_like) in ("0", "1")


def test_best_works_when_the_only_audio_is_not_m4a():
    opus_only = [_audio("251", ext="webm", acodec="opus"), _video("137", 1080, "avc1.640028")]
    assert _selected("best", opus_only) == "137+251"


@pytest.mark.parametrize("quality", ALL_LABELS)
def test_every_label_ends_with_a_catch_all_so_downloads_never_get_stricter(quality):
    from backend.video_utils import quality_to_format
    fmt = quality_to_format(quality)
    assert fmt.endswith("/best")
    odd = [{"format_id": "only", "url": "https://example.com/only", "ext": "flv", "vcodec": "vp6", "acodec": "mp3",
            "height": 240, "width": 320, "protocol": "https"}]
    assert _selected(quality, odd) == "only"


@pytest.mark.parametrize("quality, cap", [("best", 1080), ("weird", 1080), ("1080p", 1080), ("720p", 720), ("480p", 480)])
def test_format_string_names_h264_and_the_height_cap(quality, cap):
    from backend.video_utils import quality_to_format
    fmt = quality_to_format(quality)
    assert "vcodec^=avc1" in fmt
    assert f"height<={cap}" in fmt


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_formats_returns_sorted_unique_heights(mock_ytdl):
    from backend.video_utils import probe_formats
    inst = MagicMock()
    mock_ytdl.return_value.__enter__.return_value = inst
    inst.extract_info.return_value = {
        "formats": [
            {"height": 720}, {"height": 1080}, {"height": 1080},
            {"height": None}, {"height": 480}, {}, {"height": 2160},
        ]
    }
    heights = probe_formats("https://youtu.be/x")
    assert heights == [2160, 1080, 720, 480]
    _, kwargs = inst.extract_info.call_args
    assert kwargs.get("download") is False


# --- cookies.txt reaches yt-dlp ------------------------------------------------

@pytest.fixture
def cookie_store(tmp_path, monkeypatch):
    """An empty app data directory, so a stored cookies.txt never leaks between tests."""
    from backend import cookies
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(tmp_path / "appdata"))
    monkeypatch.setattr(cookies, "_copy_dir", lambda: str(tmp_path / "copies"))
    return cookies


def _store_cookies(cookies):
    import time
    expires = int(time.time()) + 86400
    cookies.save_cookies(
        f"# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t{expires}\tSAPISID\tS3CRET\n".encode()
    )


def _record_cookiefiles(mock_ytdl):
    """Capture the cookie file each YoutubeDL was built with, read while it still exists."""
    seen = []

    def build(opts):
        path = opts.get("cookiefile")
        content = None
        if path:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        seen.append((path, content))
        return mock_ytdl.return_value

    mock_ytdl.side_effect = build
    return seen


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_passes_a_copy_of_the_stored_cookies_to_yt_dlp(mock_ytdl, cookie_store, tmp_path):
    import os
    _store_cookies(cookie_store)
    seen = _record_cookiefiles(mock_ytdl)

    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert len(seen) == 1
    path, content = seen[0]
    assert "\tSAPISID\tS3CRET" in content
    assert os.path.abspath(path) != os.path.abspath(cookie_store.get_cookies_path())
    assert not os.path.exists(path)  # the copy is gone once the download returns
    assert os.path.exists(cookie_store.get_cookies_path())


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_has_no_cookiefile_option_when_none_is_stored(mock_ytdl, cookie_store, tmp_path):
    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    opts = mock_ytdl.call_args[0][0]
    assert "cookiefile" not in opts


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_attempts_that_send_cookies_share_one_working_copy(mock_ytdl, cookie_store, tmp_path):
    from yt_dlp.utils import DownloadError
    from backend.errors import AppError
    _store_cookies(cookie_store)
    seen = _record_cookiefiles(mock_ytdl)
    mock_ytdl.return_value.__enter__.return_value.download.side_effect = DownloadError(UNRECOGNISED)

    with pytest.raises(AppError):
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None, ["web_embedded"], ["android_vr"]]
    with_cookies = seen[:2]
    assert all(content and "\tSAPISID\t" in content for _, content in with_cookies)
    assert len({path for path, _ in with_cookies}) == 1
    assert seen[2] == (None, None)  # android_vr cannot carry cookies


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_passes_a_copy_of_the_stored_cookies_to_yt_dlp(mock_ytdl, cookie_store):
    import os
    from backend.video_utils import probe_formats
    _store_cookies(cookie_store)
    seen = _record_cookiefiles(mock_ytdl)
    mock_ytdl.return_value.__enter__.return_value.extract_info.return_value = {"formats": [{"height": 720}]}

    assert probe_formats("https://youtu.be/x") == [720]

    assert len(seen) == 1
    path, content = seen[0]
    assert "\tSAPISID\tS3CRET" in content
    assert os.path.abspath(path) != os.path.abspath(cookie_store.get_cookies_path())
    assert not os.path.exists(path)


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_has_no_cookiefile_option_when_none_is_stored(mock_ytdl, cookie_store):
    from backend.video_utils import probe_formats
    mock_ytdl.return_value.__enter__.return_value.extract_info.return_value = {"formats": [{"height": 720}]}

    assert probe_formats("https://youtu.be/x") == [720]

    opts = mock_ytdl.call_args[0][0]
    assert "cookiefile" not in opts


# --- yt-dlp options per attempt: cookies, Deno/EJS, player client ----------------

BASE_OPTS = {"quiet": True, "skip_download": True}
DENO = "/opt/deno/bin/deno"
COOKIEFILE = "/tmp/run-cookies.txt"

SIGNIN_BOT = (
    "ERROR: [youtube] x: Sign in to confirm you’re not a bot. "
    "Use --cookies-from-browser or --cookies for the authentication."
)
PRIVATE_VIDEO = "ERROR: [youtube] x: Private video. Sign in if you've been granted access to this video"
RATE_LIMITED = "ERROR: [youtube] x: HTTP Error 429: Too Many Requests"
DISK_FULL = "ERROR: unable to write data: [Errno 28] No space left on device"
UNRECOGNISED = "ERROR: [youtube] x: Requested format is not available"


def _clients(mock_ytdl):
    """The player client each YoutubeDL was built for; None means yt-dlp's own choice."""
    return [
        call.args[0].get("extractor_args", {}).get("youtube", {}).get("player_client")
        for call in mock_ytdl.call_args_list
    ]


@pytest.fixture
def no_deno(monkeypatch):
    from backend import preflight
    monkeypatch.setattr(preflight, "_deno_path", lambda: None)


@pytest.fixture
def deno_installed(monkeypatch):
    from backend import preflight
    monkeypatch.setattr(preflight, "_deno_path", lambda: DENO)


def _failing(mock_ytdl, *messages):
    """Make each YoutubeDL run fail with the next message; None lets that run succeed."""
    from yt_dlp.utils import DownloadError
    inst = mock_ytdl.return_value.__enter__.return_value
    effects = [DownloadError(m) if m else None for m in messages]
    inst.download.side_effect = effects
    inst.extract_info.side_effect = [e if e else {"formats": [{"height": 720}]} for e in effects]
    return inst


def test_options_without_cookies_and_without_deno():
    from backend.video_utils import ytdlp_attempt_options
    opts = ytdlp_attempt_options(BASE_OPTS, None, cookiefile=None, deno_path=None)

    assert opts == BASE_OPTS  # nothing added: yt-dlp runs with its own defaults


def test_options_with_cookies_and_without_deno():
    from backend.video_utils import ytdlp_attempt_options
    opts = ytdlp_attempt_options(BASE_OPTS, None, cookiefile=COOKIEFILE, deno_path=None)

    assert opts["cookiefile"] == COOKIEFILE
    assert "js_runtimes" not in opts
    assert "remote_components" not in opts


def test_options_without_cookies_and_with_deno():
    from backend.video_utils import ytdlp_attempt_options
    opts = ytdlp_attempt_options(BASE_OPTS, None, cookiefile=None, deno_path=DENO)

    assert "cookiefile" not in opts
    assert opts["js_runtimes"] == {"deno": {"path": DENO}}
    assert opts["remote_components"] == ["ejs:github"]


def test_options_with_cookies_and_with_deno():
    from backend.video_utils import ytdlp_attempt_options
    opts = ytdlp_attempt_options(BASE_OPTS, None, cookiefile=COOKIEFILE, deno_path=DENO)

    assert opts["cookiefile"] == COOKIEFILE
    assert opts["js_runtimes"] == {"deno": {"path": DENO}}
    assert opts["remote_components"] == ["ejs:github"]


def test_options_keep_the_base_options_and_do_not_change_them():
    from backend.video_utils import ytdlp_attempt_options
    base = {"format": "best", "outtmpl": "out.mp4"}
    opts = ytdlp_attempt_options(base, "web_embedded", cookiefile=COOKIEFILE, deno_path=DENO)

    assert opts["format"] == "best" and opts["outtmpl"] == "out.mp4"
    assert base == {"format": "best", "outtmpl": "out.mp4"}


def test_first_attempt_leaves_the_client_choice_to_yt_dlp():
    from backend.video_utils import ytdlp_attempt_options
    assert "extractor_args" not in ytdlp_attempt_options(BASE_OPTS, None, cookiefile=None, deno_path=None)


def test_fallback_attempt_asks_for_exactly_one_client():
    from backend.video_utils import ytdlp_attempt_options
    opts = ytdlp_attempt_options(BASE_OPTS, "web_embedded", cookiefile=None, deno_path=None)
    assert opts["extractor_args"] == {"youtube": {"player_client": ["web_embedded"]}}


def test_android_vr_attempt_never_sends_cookies():
    from backend.video_utils import ytdlp_attempt_options
    assert "cookiefile" not in ytdlp_attempt_options(BASE_OPTS, "android_vr", cookiefile=COOKIEFILE, deno_path=None)
    assert "cookiefile" in ytdlp_attempt_options(BASE_OPTS, "web_embedded", cookiefile=COOKIEFILE, deno_path=None)


def test_client_order_is_yt_dlp_default_then_web_embedded_then_android_vr():
    from yt_dlp.extractor.youtube._base import INNERTUBE_CLIENTS
    from backend.video_utils import PLAYER_CLIENT_ORDER

    assert PLAYER_CLIENT_ORDER == (None, "web_embedded", "android_vr")
    # A yt-dlp upgrade that drops one of these clients must fail here, not at download time.
    assert all(client in INNERTUBE_CLIENTS for client in PLAYER_CLIENT_ORDER[1:])


def _silent_ydl(opts):
    import yt_dlp
    from backend.video_utils import _SilentLogger
    return yt_dlp.YoutubeDL({**opts, "quiet": True, "no_warnings": True, "logger": _SilentLogger()})


def test_installed_yt_dlp_reads_the_requested_player_client():
    """The option shape is checked against the installed yt-dlp, which ignores a wrong one silently."""
    from backend.video_utils import ytdlp_attempt_options
    ydl = _silent_ydl(ytdlp_attempt_options({}, "web_embedded", cookiefile=None, deno_path=None))

    assert ydl.get_info_extractor("Youtube")._configuration_arg("player_client") == ["web_embedded"]


def test_installed_yt_dlp_accepts_the_deno_and_ejs_options():
    """yt-dlp drops runtime and component names it does not know; these must survive."""
    from backend.video_utils import ytdlp_attempt_options
    ydl = _silent_ydl(ytdlp_attempt_options({}, None, cookiefile=None, deno_path=DENO))

    assert ydl.params["js_runtimes"] == {"deno": {"path": DENO}}
    assert ydl.params["remote_components"] == {"ejs:github"}


# --- attempt order and stopping early ---------------------------------------------

@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_tries_the_clients_in_order_until_one_works(mock_ytdl, cookie_store, no_deno, tmp_path):
    _failing(mock_ytdl, UNRECOGNISED, UNRECOGNISED, None)

    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None, ["web_embedded"], ["android_vr"]]


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_does_not_try_another_client_after_a_success(mock_ytdl, cookie_store, no_deno, tmp_path):
    _failing(mock_ytdl, UNRECOGNISED, None)

    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None, ["web_embedded"]]


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_tries_each_client_once(mock_ytdl, cookie_store, no_deno, tmp_path):
    from backend.errors import AppError
    _failing(mock_ytdl, UNRECOGNISED, UNRECOGNISED, UNRECOGNISED)

    with pytest.raises(AppError) as excinfo:
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None, ["web_embedded"], ["android_vr"]]
    assert excinfo.value.code == "UNKNOWN"
    assert str(excinfo.value) == UNRECOGNISED


@pytest.mark.parametrize("message, code", [
    (PRIVATE_VIDEO, "VIDEO_UNAVAILABLE"),
    (RATE_LIMITED, "YT_RATE_LIMITED"),
    (DISK_FULL, "DISK_FULL"),
])
@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_stops_at_an_error_another_client_cannot_fix(mock_ytdl, message, code, cookie_store, no_deno, tmp_path):
    from backend.errors import AppError
    _failing(mock_ytdl, message, None, None)

    with pytest.raises(AppError) as excinfo:
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None]
    assert excinfo.value.code == code
    assert str(excinfo.value) == message


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_signin_error_without_cookies_moves_on_to_the_fallback_clients(mock_ytdl, cookie_store, no_deno, tmp_path):
    from backend.errors import AppError
    _failing(mock_ytdl, SIGNIN_BOT, SIGNIN_BOT, SIGNIN_BOT)

    with pytest.raises(AppError) as excinfo:
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None, ["web_embedded"], ["android_vr"]]
    assert excinfo.value.code == "YT_SIGNIN_REQUIRED"


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_signin_error_without_cookies_can_be_fixed_by_a_fallback_client(mock_ytdl, cookie_store, no_deno, tmp_path):
    _failing(mock_ytdl, SIGNIN_BOT, None)

    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None, ["web_embedded"]]


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_signin_error_with_cookies_stops_at_once(mock_ytdl, cookie_store, no_deno, tmp_path):
    from backend.errors import AppError
    _store_cookies(cookie_store)
    _failing(mock_ytdl, SIGNIN_BOT, None, None)

    with pytest.raises(AppError) as excinfo:
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None]
    assert excinfo.value.code == "YT_SIGNIN_REQUIRED"


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_the_reported_error_is_the_first_one_the_user_can_act_on(mock_ytdl, cookie_store, no_deno, tmp_path):
    from backend.errors import AppError
    _failing(mock_ytdl, SIGNIN_BOT, UNRECOGNISED, UNRECOGNISED)

    with pytest.raises(AppError) as excinfo:
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert excinfo.value.code == "YT_SIGNIN_REQUIRED"
    assert str(excinfo.value) == SIGNIN_BOT


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_a_later_recognised_error_replaces_an_unrecognised_one(mock_ytdl, cookie_store, no_deno, tmp_path):
    from backend.errors import AppError
    _failing(mock_ytdl, UNRECOGNISED, RATE_LIMITED, None)

    with pytest.raises(AppError) as excinfo:
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert _clients(mock_ytdl) == [None, ["web_embedded"]]
    assert excinfo.value.code == "YT_RATE_LIMITED"


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_cancelled_download_does_not_try_another_client(mock_ytdl, cookie_store, no_deno, tmp_path):
    from backend.video_utils import DownloadCancelledError
    _failing(mock_ytdl, UNRECOGNISED, None, None)

    with pytest.raises(DownloadCancelledError):
        download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"), is_cancelled=lambda: True)

    assert _clients(mock_ytdl) == [None]


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_tries_the_clients_in_order_until_one_works(mock_ytdl, cookie_store, no_deno):
    from backend.video_utils import probe_formats
    _failing(mock_ytdl, SIGNIN_BOT, UNRECOGNISED, None)

    assert probe_formats("https://youtu.be/x") == [720]

    assert _clients(mock_ytdl) == [None, ["web_embedded"], ["android_vr"]]


@pytest.mark.parametrize("message, code", [
    (PRIVATE_VIDEO, "VIDEO_UNAVAILABLE"),
    (RATE_LIMITED, "YT_RATE_LIMITED"),
])
@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_stops_at_an_error_another_client_cannot_fix(mock_ytdl, message, code, cookie_store, no_deno):
    from backend.errors import AppError
    from backend.video_utils import probe_formats
    _failing(mock_ytdl, message, None, None)

    with pytest.raises(AppError) as excinfo:
        probe_formats("https://youtu.be/x")

    assert _clients(mock_ytdl) == [None]
    assert excinfo.value.code == code


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_signin_error_with_cookies_stops_at_once(mock_ytdl, cookie_store, no_deno):
    from backend.errors import AppError
    from backend.video_utils import probe_formats
    _store_cookies(cookie_store)
    _failing(mock_ytdl, SIGNIN_BOT, None, None)

    with pytest.raises(AppError) as excinfo:
        probe_formats("https://youtu.be/x")

    assert _clients(mock_ytdl) == [None]
    assert excinfo.value.code == "YT_SIGNIN_REQUIRED"


# --- Deno reaches yt-dlp on both paths ---------------------------------------------

@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_turns_on_deno_and_ejs_when_deno_is_installed(mock_ytdl, cookie_store, deno_installed, tmp_path):
    _failing(mock_ytdl, UNRECOGNISED, None)

    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    assert len(mock_ytdl.call_args_list) == 2
    for call in mock_ytdl.call_args_list:
        assert call.args[0]["js_runtimes"] == {"deno": {"path": DENO}}
        assert call.args[0]["remote_components"] == ["ejs:github"]


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_still_runs_when_deno_is_missing(mock_ytdl, cookie_store, no_deno, tmp_path):
    inst = _failing(mock_ytdl, None)

    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    inst.download.assert_called_once_with(["https://youtu.be/x"])
    opts = mock_ytdl.call_args[0][0]
    assert "js_runtimes" not in opts
    assert "remote_components" not in opts


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_download_still_runs_when_looking_for_deno_fails(mock_ytdl, cookie_store, monkeypatch, tmp_path):
    from backend import preflight

    def broken():
        raise OSError("PATH is unreadable")

    monkeypatch.setattr(preflight, "_deno_path", broken)
    inst = _failing(mock_ytdl, None)

    download_youtube_video("https://youtu.be/x", str(tmp_path / "video.mp4"))

    inst.download.assert_called_once_with(["https://youtu.be/x"])
    assert "js_runtimes" not in mock_ytdl.call_args[0][0]


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_turns_on_deno_and_ejs_when_deno_is_installed(mock_ytdl, cookie_store, deno_installed):
    from backend.video_utils import probe_formats
    _failing(mock_ytdl, None)

    assert probe_formats("https://youtu.be/x") == [720]

    opts = mock_ytdl.call_args[0][0]
    assert opts["js_runtimes"] == {"deno": {"path": DENO}}
    assert opts["remote_components"] == ["ejs:github"]


@patch('backend.video_utils.yt_dlp.YoutubeDL')
def test_probe_still_runs_when_deno_is_missing(mock_ytdl, cookie_store, no_deno):
    from backend.video_utils import probe_formats
    _failing(mock_ytdl, None)

    assert probe_formats("https://youtu.be/x") == [720]

    opts = mock_ytdl.call_args[0][0]
    assert "js_runtimes" not in opts
    assert "remote_components" not in opts
