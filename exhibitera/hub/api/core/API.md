# Exhibitera Core API
This file describes the current Core API.

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
An array of strings (usually empty) indicating actions the component should take. Each string will be one of the following:

- `refresh_page`: Reload the content to an initial state
- `restart`: Restart the PC
- `shutdown`: Shutdown the PC
- `sleepDisplay`: Turn off the connected display
- `wakeDisplay`: Turn on the connected display

##### definition
You may choose to allow administrators to select from different app states using Hub. These app states are called `definitions`. If so, the currently selected definition (a UUID4 string) will be listed here.