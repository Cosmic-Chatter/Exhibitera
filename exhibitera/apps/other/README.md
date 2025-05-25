# Custom App
While Exhibitera provides a broad suite of app options, it might not cover your specific need. In that case, you can connect a custom web app to Exhibitera Hub to include it in your exhibitions.

_**Good to know**: If you're not using Exhibitera Hub, using Exhibitera App's Custom App functionality might not be the easiest option. Instead, consider setting up Kiosk Mode in a browser of your choice._

## Modes
### Basic
In basic mode, your web app doesn't need to know anything about Exhibitera. As long as it is a collection of `HTML`, `JavaScript`,  `CSS`, and media files, Exhibitera Apps can load it and connect to Hub.

### Advanced
If you need to utilize any of the Exhibitera APIs, you should set up your web app in advanced mode. This enables you to create an app that utilizes the same technology as apps like Media Browser or Timelapse Viewer.

**For your advanced app to work correctly, you must implement the Exhibitera Core API.** If you don't implement the Core API, your app will not correctly respond to commands from Hub.

#### Key-value pairs
When creating your Custom App definition as an advanced app, you have the option to create key-value pairs. This allows you to pass your app details specific to this definition. 

These key-value pairs are stored in a dictionary under the `properties` field of the definition. An advanced app definition will look like this:

```json
{
  "app": "other",
  "exhibitera_version": {
    "major": 6,
    "minor": 0,
    "patch": 0
  },
  "lastEditedDate": "2025-05-20T23:02:11.819Z",
  "mode": "advanced",
  "name": "Example app definition",
  "path": "static/test/test.html",
  "properties": {
    "time": "night",
    "volume": "55"
  },
  "uuid": "3f83749d-c927-4f98-9c00-d139eb062138"
}
```

For example, you might create a `time` key. In one definition, you might set `time` to `day`, while in another definition, you might set it to `night`. Then, your app can respond differently to the nighttime definition versus the daytime one.

_**Good to know**: Keys and values are always stored as strings._

### URL
In URL mode, Exhibitera Apps loads your web app from the provided URL. Once the app is loaded, it is treated like a basic app.

#### Why your URL may not load
Websites can choose to disable embedding as a security measure. For instance, a malicious actor could embed your bank's webpage and then trick you into entering your login credentials to steal your account. Because of this, modern browsers—including the web engine at the heart of Exhibitera—strictly enforce website limitations.

_**Good to know**: If you control the webpage you're trying to load, you can enable embedding by ensuring you allow cross-origin requests (CORS)._

## Uploading files
Simple apps containing only a few files in a single directory can easily uploaded via the Custom App setup page. However, if your app contains many files or files in subdirectories, you will need to copy the files manually into Exhibitera Apps.

To do this, navigate to your Exhibitera Apps directory and find the `static` subdirectory inside. There, you can place your files and folders, which you can then select from the setup page.