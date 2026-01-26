# Exhibitera Core API
This file describes the current Core API.

## Sending API
These endpoints are maintained by Apps and can be accessed by your application

### /core/checkConnection [GET]
Check if Apps connection is accessible

#### Return
```json
{
  success: true // Always returns true
}
```

### /core/data/[name]/rawText [GET]
Retrieve text saved to Hub under the given `[name]`.

#### Path parameters
- `name`: The name of the record whose contents should be returned. `name` should have been previously saved by using the `POST` version of this endpoint.

#### Returns
```json
{
  success: true,
  reason: "" // Gives reason for failure if success == false,
  text: "The saved text"
}
```

### /core/data/[name]/rawText [POST]
Save text in a named record on Hub.

#### Path parameters
- `name`: Name of the record to save text to. The namespace is shared by all components connected to that Hub, so `name` should be unique to your app, such as `"MyAppName_recordName"`.

#### Body
```json
{
  mode: "a", // "a" (defualt) for append or "w" for overwrite. 
  text: "Some\ntext\nto write"
}
```

When using `mode="a"` to append text, it is appended to a new line in the file.

#### Returns
```json
{
  success: true,
  reason: "" // Gives reason for failure if success == false,
}
```

### /core/system/restart [GET]
Restart the PC where Apps is running.

### /core/system/shutdown [GET]
Shutdown the PC where Apps is running.

### /core/system/sleepDisplay [GET]
Put the display connected to the PC running Apps to sleep.

### /core/system/wakeDisplay [GET]
Wake up the display connected to the PC running apps.

## Receiving API
Your application should listen at your `helper_address` for the following endpoints. No receiving endpoint is required, but they provide better integration with Exhibitera native apps.