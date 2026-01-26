# Exhibitera Core API
This file describes the current Core API.

## Sending API
These endpoints are maintained by Hub and can be accessed by your application

### /core/ping [POST]
#### Body

```json
{
  current_interaction: false, // Whether someone is actively interacting with the component [optional]
  helper_address: "192.168.1.27:8000",
  // Webserver address where this component can be contacted [optional]
  permisssions: {
    audio: true,
    refresh: true,
    restart: true,
    shutdown: false,
    sleep: false
  }, // A dictionary of Exhibitera permissions [optional]
  uuid: "6f11a4e4-b389-45af-811a-042fae1580e3"
  // Random UUID4 identifier [required]
}
```

#### Return
```json
{
  commands: ["command 1", "command 2", ...], // An array of commands for the component
  definition: "definition UUID", // The definition that is currently selected
  success: true // Whether the ping was received correctly
}
```

##### commands
A (usually empty) array of strings indicating actions the component should take. Each string will be one of the following:

- `refresh_page`: Reload the content to an initial state
- `restart`: Restart the PC
- `shutdown`: Shutdown the PC
- `sleep_display`: Turn off the connected display
- `wake_display`: Turn on the connected display

##### definition
You may choose to allow administrators to select from different app states using Hub. These app states are called `definitions`. If so, the currently selected definition (a UUID4 string) will be listed here.


### /core/checkConnection [GET]
Check if Hub is accessible

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
  reason: "" // Gives reason for failure if success == false
}
```

## Receiving API
Your application should listen at your `helper_address` for the following endpoints. No receiving endpoint is required, but they provide better integration with Exhibitera native apps.


### /core/restart [GET]
Restart the PC.

### /core/screenshot [GET]
Return a screenshot of the current display as a JPEG blob.

### /core/shutdown [GET]
Shutdown the PC.