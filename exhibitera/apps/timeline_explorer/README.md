# Timeline Explorer
Timeline Explorer builds touchscreen timelines from a spreadsheet.

## Configuration

### Describing your timeline
To describe the items in your timeline, you create a simple spreadsheet. Timeline Explorer requires spreadsheets to be in the common _comma-separated value_ (`CSV`) format. 

Microsoft Excel, Apple Numbers, LibreOffice Calc, and other apps can save `CSV` files. If you are using Microsoft Excel, you can easily create this file by choosing _File_ > _Save As..._ and selecting _CSV UTF-8 (Comma delimited) (.csv)_ from the File Format options.

A simple spreadsheet might look like this:

| Date | Level | Title      | Body text                                                                                                                                              | Image          |
|------|-------|------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|----------------|
| 1820 | 2     | George IV  | George IV was the first British monarch to gain the throne in the 19th century. He reigned 10 years.                                                   | George_IV.jpg  |
| 1830 | 3     | William IV | William Iv reigned for nearly seven years.                                                                                                             | William_IV.jpg |
| 1837 | 1     | Victoria   | Victoria reigned for more than 63 years, longer than any prior British monarch. Her reign was marked by a significant expansion of the British empire. | Victoria.png   |
| 1901 | 3     | Edward VII | Edward VII, the eldest son of Queen Victoria, was heir apparent for more than 60 years before gaining the throne.                                      | Edward_VII.jpg |
| 1910 | 2     | George V   | In a reign of more than 25 years, George V steered the British Empire through WWI and the run-up to WWII.                                              | George_V.tiff  |

Each line in the spreadsheet will represent one item in the timeline. The media files (listed in the  `Image` column in this example). need to be uploaded to **_Exhibitera_** as content.

The `Level` column allows you to differentiate between events of different importance in the timeline by specifying a number from 1 to 4. Level 1 events are the most important and Level 4 are the least important.

### Optimizing media
Timeline Explorer is designed to handle hundreds of timeline entries in an efficient way. To balance performance and quality, you should use the `Optimize content` tool. This will smartly resize the thumbnail images for maximum perceived quality while retaining the best performance. This process does not alter the original content file.