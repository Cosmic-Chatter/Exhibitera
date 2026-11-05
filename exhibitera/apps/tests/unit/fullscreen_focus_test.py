"""Verify that the app page has keyboard focus once Apps' window loads on Windows, such as after F11.

Toggling fullscreen replaces the app window with a new one. On Windows, pywebview gives the new window's web view
focus as soon as the window is shown, before the page inside it exists, so key presses such as F11 didn't reach
the page until someone clicked in it. Apps now moves focus into the page once it has loaded.

pythonnet and WebView2 only exist on Windows, so these tests stand in fakes for the few .NET pieces Apps uses.
"""

# Standard modules
import inspect
import sys
import types

# Third-party modules
import pytest

# Exhibitera modules
import exhibitera.apps.config as apps_config
import exhibitera.apps.features.apps_webview as apps_webview


class FakeController:
    def __init__(self):
        self.moves = []

    def MoveFocus(self, reason):
        self.moves.append(reason)


class FakeWebView2:
    """The WinForms WebView2 control, which keeps its CoreWebView2Controller in a private field."""

    def __init__(self, controller):
        self._coreWebView2Controller = controller
        self.focus_calls = 0

    def Focus(self):
        self.focus_calls += 1

    def GetType(self):
        webview2 = self

        class FieldInfo:
            def GetValue(self, target):
                return target._coreWebView2Controller

        class WebView2Type:
            def GetField(self, name, flags):
                has_field = name == '_coreWebView2Controller' and webview2._coreWebView2Controller is not None
                return FieldInfo() if has_field else None

        return WebView2Type()


class FakeForm:
    """pywebview's Windows form, which runs code on its UI thread with Invoke."""

    def __init__(self, webview2):
        self.browser = types.SimpleNamespace(webview=webview2)
        self.on_ui_thread = False
        self.invokes = 0

    def Invoke(self, func):
        self.invokes += 1
        self.on_ui_thread = True
        try:
            func()
        finally:
            self.on_ui_thread = False


class FakeEvent:
    def __init__(self):
        self.handlers = []

    def __iadd__(self, handler):
        self.handlers.append(handler)
        return self

    def fire(self, window):
        # pywebview passes the window to handlers that take a "window" parameter
        for handler in self.handlers:
            if 'window' in inspect.signature(handler).parameters:
                handler(window)
            else:
                handler()


@pytest.fixture
def windows(monkeypatch):
    """Pretend to be Apps on Windows, returning a function that opens the app window and loads its page."""

    monkeypatch.setattr(sys, 'platform', 'win32')
    # Form.ActiveForm is the window in front, if it belongs to Apps
    forms_module = types.SimpleNamespace(Form=types.SimpleNamespace(ActiveForm=None))

    class Func:
        def __class_getitem__(cls, item):
            return lambda func: func

    fake_modules = {
        'System': types.SimpleNamespace(Func=Func, Type=object,
                                        Object=types.SimpleNamespace(ReferenceEquals=lambda a, b: a is b)),
        'System.Reflection': types.SimpleNamespace(BindingFlags=types.SimpleNamespace(Instance=4, NonPublic=32)),
        'System.Windows.Forms': forms_module,
        'Microsoft.Web.WebView2.Core': types.SimpleNamespace(
            CoreWebView2MoveFocusReason=types.SimpleNamespace(Programmatic='Programmatic')),
    }
    for name, module in fake_modules.items():
        monkeypatch.setitem(sys.modules, name, module)

    monkeypatch.setattr(apps_webview.webview, 'windows', [])
    monkeypatch.setattr(apps_config, 'defaults', {'system': {'port': 8000}})
    monkeypatch.setattr(apps_config, 'webview_fullscreen', False)

    def open_app_window(controller=None, in_front=True):
        webview2 = FakeWebView2(controller)
        form = FakeForm(webview2)
        window = types.SimpleNamespace(title='Exhibitera Apps', native=form,
                                       events=types.SimpleNamespace(loaded=FakeEvent(), closing=FakeEvent()))
        monkeypatch.setattr(apps_webview.webview, 'create_window', lambda *args, **kwargs: window)
        apps_webview.show_app_window()
        forms_module.Form.ActiveForm = form if in_front else object()
        window.events.loaded.fire(window)
        return form, webview2

    return open_app_window


def test_page_gets_focus_once_it_loads(windows):
    controller = FakeController()
    apps_config.block_closing = True
    form, webview2 = windows(controller)

    # Focus moves into the page itself, on the window's UI thread
    assert controller.moves == ['Programmatic']
    assert form.invokes == 1
    # Loading still lets the window close normally
    assert apps_config.block_closing is False


def test_web_view_is_focused_if_its_controller_is_out_of_reach(windows):
    # WebView2 keeps its controller in a private field, which a future version could rename
    form, webview2 = windows(controller=None)

    assert webview2.focus_calls == 1


def test_windows_in_front_keep_focus(windows):
    # The app page reloads when its settings change, perhaps while a settings window is in front
    controller = FakeController()
    form, webview2 = windows(controller, in_front=False)

    assert (controller.moves, webview2.focus_calls) == ([], 0)


def test_focus_problems_dont_stop_the_app(windows, caplog):
    class BrokenController:
        def MoveFocus(self, reason):
            raise RuntimeError('WebView2 is gone')

    apps_config.block_closing = True
    windows(BrokenController())

    assert apps_config.block_closing is False
    assert 'WebView2 is gone' in caplog.text


def test_new_window_opens_before_the_old_one_closes(monkeypatch):
    # Windows only lets the program in front bring a new window to the front. Closing the old window first hands
    # the front to another window, so the new one opened behind it, without covering the taskbar in fullscreen.
    steps = []

    def window(title):
        return types.SimpleNamespace(title=title, destroy=lambda: steps.append('close ' + title),
                                     events=types.SimpleNamespace(loaded=FakeEvent(), closing=FakeEvent()))

    def create_window(title, **kwargs):
        steps.append('open ' + title)
        return window(title)

    monkeypatch.setattr(apps_webview.webview, 'windows', [window('master'), window('Exhibitera Apps'),
                                                          window('Exhibitera Apps - Configuration')])
    monkeypatch.setattr(apps_webview.webview, 'create_window', create_window)
    monkeypatch.setattr(apps_config, 'defaults', {'system': {'port': 8000}})
    monkeypatch.setattr(apps_config, 'webview_fullscreen', False)

    apps_webview.ExhibiteraWebviewAPI().toggle_fullscreen()

    assert steps == ['open Exhibitera Apps', 'close Exhibitera Apps']
    assert apps_config.webview_fullscreen is True


def test_other_systems_are_left_alone(windows, monkeypatch):
    # pywebview's other backends don't have this problem
    monkeypatch.setattr(sys, 'platform', 'darwin')
    controller = FakeController()
    form, webview2 = windows(controller)

    assert (form.invokes, controller.moves, webview2.focus_calls) == (0, [], 0)
