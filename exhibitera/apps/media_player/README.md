# Media Player

Media Player provides a flexible digital signage platform for displaying collections of audio, images, and videos. Dynamic signage can be created by retrieving and updating data from JSON sources.

## Configuration
When creating a definition, you can specify a display duration for each image. Audio and video always play for their full duration.

### Annotations
Annotations enable you to add dynamic text to your media through the use of JSON-formatted data. Media Player supports accessing JSON from either a web link or a text file in the Constellation content directory.

JSON data is refreshed every time a piece of content is played. For definitions with multiple media files, this happens each time the annotated file is reached in the playlist. For definitions with a single file, this happens at the interval given by the `duration`.

**When using an external data URL, be sure to respect access limits.** Don't set a duration of a few seconds if the data doesn't need to be refreshed more than once an hour, for example.

## Supported media types
Exhibitera Apps recognizes the following media file formats:

| Type  | Recognized formats                                          |
|-------|-------------------------------------------------------------|
| Audio | `aac`, `m4a`, `mp3`, `oga`, `ogg`, `weba`, `wav`            |
| Image | `bmp`, `heic`, `jpeg`, `jpg`, `png`, `tif`, `tiff`,  `webp` |
| Video | `m4v`, `mov`, `mp4`, `mpeg`,    `mpg`,  `ogv`, `webm`       |