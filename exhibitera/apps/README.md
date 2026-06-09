## Configuration

### Using a remote display
By default, Exhibitera Apps will run as self-contained app when using Windows. If you are using a Windows PC as your exhibit computer, you're done!

If you wish to use an iPad or other remote device as your guest-facing interface, or if you are using Linux, Exhibitera Apps needs to run with a remote display. When using a remote display, Exhibitera Apps will launch as a command-line window. You then access the app using a regular web browser. For example, if your PC has a static IP address of `192.168.1.122` and you are using port `8000`, access Exhibitera Apps from `http://192.168.1.122:8000`.

## Deploying Exhibitera Apps
When configuring the app for use on the museum floor, it is strongly recommended to set it up in kiosk mode. This will lock users into the application and supress many pop-ups.

### Disabling gestures

#### Windows 11
Using Windows 11, you can disable touchscreen gestures from the settings menu.

#### Linux (Ubuntu)
To disable gestures on Ubuntu 22.04 using these commands:

```commandline
wget "https://extensions.gnome.org/extension-data/disable-gestures-2021verycrazydog.gmail.com.v4.shell-extension.zip"

gnome-extensions install disable-gestures-2021verycrazydog.gmail.com.v4.shell-extension.zip

reboot
```

#### macOS
On macOS, it is not possible to hide the dock and menu bar permanently, so macOS is not recommended for use with a touchscreen.

### Configuring fullscreen
To launch Exhibitera Apps in fullscreen mode, follow the directions below. You can toggle fullscreen on or off at any time using the F11 key (Fn-Shift-F11 on macOS).

#### Windows and macOS

To launch Exhibitera in fullscreen, toggle the _Start in fullscreen_ option on the main settings page.

#### Linux and remote devices
If you are running Exhibitera Apps in remote display mode, you must configure your browser of choice to open in Kiosk mode. Follow the linked instructions for [Firefox](https://support.mozilla.org/en-US/kb/firefox-enterprise-kiosk-mode) and [Edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-configure-kiosk-mode).

#### iOS and iPadOS
For iOS or iPadOS, first add the app to the home screen following the section _Add a website icon to your Home Screen_ [here](https://support.apple.com/guide/iphone/bookmark-favorite-webpages-iph42ab2f3a7/ios). Then, configure Guided Access by following [these instructions](https://support.apple.com/en-us/HT202612).