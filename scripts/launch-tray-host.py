"""Private session-bus StatusNotifier fixture; never claims real shell coverage.

Run only under dbus-run-session. The app uses its actual platform host detection
and appindicator registration, window close handler and native lock service.
"""
import os
import subprocess
import sys
import threading

import gi
from gi.repository import Gio, GLib

bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
xml = '''<node><interface name="org.kde.StatusNotifierWatcher">
<method name="RegisterStatusNotifierItem"><arg type="s" direction="in"/></method>
<property name="IsStatusNotifierHostRegistered" type="b" access="read"/>
<property name="RegisteredStatusNotifierItems" type="as" access="read"/>
<property name="ProtocolVersion" type="i" access="read"/>
<signal name="StatusNotifierItemRegistered"><arg type="s"/></signal>
</interface></node>'''
items = []

def method(connection, sender, path, interface, name, parameters, invocation):
    item = parameters.unpack()[0]
    items.append(sender + item if item.startswith('/') else item)
    invocation.return_value(None)
    connection.emit_signal(None, path, interface, 'StatusNotifierItemRegistered',
                           GLib.Variant('(s)', (items[-1],)))

def prop(connection, sender, path, interface, name):
    return {'IsStatusNotifierHostRegistered': GLib.Variant('b', True),
            'RegisteredStatusNotifierItems': GLib.Variant('as', items),
            'ProtocolVersion': GLib.Variant('i', 0)}[name]

bus.register_object('/StatusNotifierWatcher', Gio.DBusNodeInfo.new_for_xml(xml).interfaces[0], method, prop, None)
bus.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus',
              'org.freedesktop.DBus', 'RequestName',
              GLib.Variant('(su)', ('org.kde.StatusNotifierWatcher', 4)),
              None, Gio.DBusCallFlags.NONE, 5000, None)
loop = GLib.MainLoop()
thread = threading.Thread(target=loop.run, daemon=True)
thread.start()
try:
    result = subprocess.run(['node', 'scripts/launch-tray-e2e.mjs'],
                            env={**os.environ, 'LAUNCH_TRAY_HOST': 'present'})
    if result.returncode == 0 and not items:
        print('TRAY_REGISTRATION_NOT_OBSERVED')
        sys.exit(1)
    sys.exit(result.returncode)
finally:
    loop.quit()
