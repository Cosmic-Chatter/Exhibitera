# Custom App
While Exhibitera provides a broad suite of app options, it might not cover your specific need. In that case, you can connect a custom web app to Exhibitera Hub to include it in your exhibitions.

_**Good to know**: If you're not using Exhibitera Hub, using Exhibitera App's Custom App functionality might not be the easiest option. Instead, consider setting up Kiosk Mode in a browser of your choice._

## Modes
### Files
In files mode, you provide the `HTML`, `JavaScript`,  `CSS` files that make up your app. Your app doesn't need to know anything about Exhibitera, but you can optionally implement the Core API to add additional functionality.

#### Key-value pairs
When creating your Custom App definition in files mode, you have the option to create key-value pairs. This allows you to pass your app details specific to this definition. 

For example, you might create a `time` key. In one definition, you might set `time` to `day`, while in another definition, you might set it to `night`. Then, your app can respond differently to the nighttime definition versus the daytime one.

To access these key-value pairs, use the `getDefinitionProperties()` function in the Core API.

_**Good to know**: Keys and values are always stored as strings._

### URL
In URL mode, Exhibitera Apps loads your web app from the provided URL. Once the app is loaded, it is treated like a basic app.

#### Why your URL may not load
Websites can choose to disable embedding as a security measure. For instance, a malicious actor could embed your bank's webpage and then trick you into entering your login credentials to steal your account. Because of this, modern browsers—including the web engine at the heart of Exhibitera—strictly enforce website limitations.

_**Good to know**: If you control the webpage you're trying to load, you can enable embedding by ensuring you allow cross-origin requests (CORS)._

## Uploading files
Simple apps containing only a few files in a single directory can easily uploaded via the Custom App setup page. However, if your app contains many files or files in subdirectories, you will need to copy the files manually into Exhibitera Apps.

To do this, navigate to your Exhibitera Apps directory and find the `static` subdirectory inside. There, you can place your files and folders, which you can then select from the setup page.