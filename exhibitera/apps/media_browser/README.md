# Media Browser
Media Browser provides a touch-screen interface for browsing large sets of images and videos.

## Configuration

### Describing your media
Using Media Browser requires creating a simple spreadsheet that describes your files. This spreadsheet will guide the app in arranging the content you wish to display. It must be saved in _comma-separated value_ (`CSV`) format and uploaded to the standard **_Constellation_** `content` directory. 

Microsoft Excel, Apple Numbers, LibreOffice Calc, and other apps can save `CSV` files. If you are using Microsoft Excel, you can easily create this file by choosing _File_ > _Save As..._ and selecting _CSV UTF-8 (Comma delimited) (.csv)_ from the File Format options.

A simple spreadsheet might look like this:

| File             | Name    | Image credit | Caption                                                                   |
|------------------|---------|--------------|---------------------------------------------------------------------------|
| Mercury.jpg      | Mercury | NASA         | Mercury is the cloest planet to the Sun.                                  |
| Venus.png        | Venus   | NASA         | Venus is the hottest planet in the solar system.                          |
| Blue Marble.jpeg | Earth   | USGS         | This image of Earth is made of multiple Landsat images stitched together. |
| Mars.png         | Mars    | ESA          | Mars is the best-explored planet beyond Earth.                            |
| Jupiter.png      | Jupiter | NASA         | Jupiter is the largest planet in the solar system.                        |
 | Saturn.png       | Saturn  | NASA         | Saturn has the most impressive ring system in the solar system.           |
| Uranus.jpeg      | Uranus  | NASA         | Uranus is the only planet to orbit on its side.                           |
| Neptune.jpg      | Neptune | NASA         | Neptune is the farthest planet in the solar system.                       |
 | Pluto.jpg        | Pluto   | NASA         | Pluto is the best-studied Kuiper belt object.                             |

Each line in the spreadsheet will represent one item in the browser. The media files (listed in the `File` column in this example). need to be uploaded to **_Constellation_** as content.

### Thumbnails
By default, **_Constellation_** will generate a thumbnail for each of your media files. For images, the thumbnail will look the same as the image. For videos, the thumbnail will be the middle frame of the video. If you'd like to provide separate thumbnails (for example, to have all square thumbnails), you can upload these to the content directory and include a thumbnail column in your spreadsheet.

### Optimizing media
Media Browser is designed to handle hundreds or even thousands of media files in an efficient way. To balance performance and quality, you should use the `Optimize content` tool. This will smartly resize the thumbnail images for maximum perceived quality while retaining the best performance. This process does not alter the original content file, which will always be displayed at full quality.