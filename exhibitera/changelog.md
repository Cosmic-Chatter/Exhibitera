# **Exhibitera 6**
_Exhibitera Hub and Apps must all be upgraded to version 6 at the same time._

## Hub

### Core API
The Core API provides a stable API that enables developers to provide basic integration with Exhibitera for their applications. Calls to this API are guaranteed to remain compatible with future versions of Hub.

### Exhibitions
- _Exhibits_ are now called _Exhibitions_
- Changing a component's definition now creates an _exhibition modification_. Modifications are not permanently stored in the exhibition; instead, they will be cleared the next time the exhibition changes. This enables you to make a temporary change (such as with the _Set definition_ schedule action) without it permanently affecting the exhibition. 

### Schedules
- Download schedules for upcoming dates from the future dates manager
- Clear all exhibition modifications with a new schedule action


## Apps

### General
- Apps that support language selection now properly display right-to-left text for Arabic and Hebrew
- Easily launch Apps fullscreen on Windows
- Creating, editing, and setting definitions is now much easier when not using Hub
- Easily access DMX lighting scenes when not using Hub 
- When using Hub, Apps now gracefully recovers to the last used definition if Hub is unavailable
- Use *Shift-click* to easily select multiple files in the file picker
- Drag and drop files on the file picker to start an upload

### Core API
The Core API provides a stable API that enables developers to provide basic integration with Exhibitera for their applications. Calls to this API are guaranteed to remain compatible with future versions of Hub.

### Custom Apps
- New Basic App option turns a simple HTML file into an app without needing to implement the Exhibitera APIs
- New URL option enables you to embed a webpage into your exhibition (limitations apply)
- Guided setup makes things easier than ever

### DMX Control
- Scenes are now separated from groups

### InfoStation
- Easily reorder your tabs
- Embed videos in the same way as images
- Rich text formatting for media captions
- Adjust the width of the sidebar in landscape view
- Adjust the height of the toolbar at the bottom 
- Adjust the corner radius of sections
- Customize the look of captions
- Guided setup makes things easier than ever

### Media Browser
- Support for audio files
- Use pinch-to-zoom to explore media in more detail
- Add a custom thumbnail separate from the main media
- Add items individually or use a spreadsheet for bulk import
- Reorder your items
- Copy Media Browser definitions to other PCs

### Media Player
- Track progress through a playlist and the current item with a progress indicator
- Adjust the opacity of watermarks
- Annotate media with custom text
- Expand videos and images to fill the display
- Guided setup makes things easier than ever

### Survey Kiosk
_This brand-new app extends Voting Kiosk to multiple survey questions, with new features and customizations._

- Text screens allow you to set up a question before options are presented
- Allow users to select multiple answer options
- Choose to randomize the order of the options for each user
- Control the appearance of each option
- Support for multiple languages

### Timelapse Viewer
- Choose between filling the screen with the video or letterboxing it to show the whole video
- Guided setup makes things easier than ever

### Timeline Explorer
- Timeline items can now include videos in addition to images
- Show media edge-to-edge for a more polished look
- Add items individually or use a spreadsheet for bulk import 
- Reorder your items
- Copy Timeline Explorer definitions to other PCs

### Word Cloud
- Switched profanity filtering library, so please check your word clouds

# **Exhibitera 5.3**

## Hub

### General
- Toggle between light and dark mode from the new user preferences window
- Notifications are now displayed in a dropdown list to better handle large quantities

### Components
- The components view can now be arranged as a grid or a list
- Change the size of the items in the component view
- Show or hide individual groups to declutter your interface
- Sort components and groups alphabetically or by their status
- Copy definitions from one component to others
  - Image Compare, Media Player, Timelapse Viewer, Voting Kiosk, and Word Cloud are currently supported

### Flexible Tracker
- Experimental option to configure interface for guest-facing data collection

### Schedule
- Downloading or creating a schedule from CSV has been removed. JSON will be the only supported format moving forward.

## Apps

### General
- Rich text editor for easier text styling with Markdown
- New size and placement options when inserting images into Markdown
- See file sizes when browsing files
- Improved multilingual support, including flags for 38 additional languages

### Image Compare
_Image Compare is a new app that creates a before/after slider between a pair of images._

### InfoStation
- Adjust the height of the header area or hide it entirely
- Insert block quotes and style them separately from regular text
- Hide the button row in portrait orientation if there is only one tab

### Media Browser
- Format text using Markdown in your spreadsheet
- Media is automatically optimized when app launches

### Media Player
- Add subtitles to videos to improve accessibility or support a second language
- Customize the appearance of your subtitles

### Timeline Explorer
- Setup wizard makes getting started a breeze
- FIne-grained control over text size
- Media is automatically optimized when app launches

# **Exhibitera 5.2**

## Hub

### Schedule
- Schedule entry summaries are more descriptive [Morgan Rehnberg]

##  Apps

### General
- Files uploaded as `content` can be downloaded using the file picker [Morgan Rehnberg]

### Media Browser
- New guided setup wizard [Morgan Rehnberg]
- Reaching the last page of results now loops back to the beginning by default [Marcello Badolato, Morgan Rehnberg]
- When only one page of results is available, the page change buttons hide automatically [Morgan Rehnberg]

### Media Player
- Experimental support for 3D models [Morgan Rehnberg]

### Voting Kiosk
- New guided setup wizard [Morgan Rehnberg]

### Word Cloud
- New guided setup wizard [Morgan Rehnberg]

# **Exhibitera 5.1**

## Hub

### General
- Changed logging behavior to reduce log sizes [Morgan Rehnberg]

### Projectors
- New, cleaner layout for projector details, including hints for common errors and warnings [Morgan Rehnberg]

### Maintenance
- Change maintenance details and basic settings even if a component is offline [Morgan Rehnberg]

## Exhibitera Apps

### General
- Better handling of long text in places like titles and captions [Morgan Rehnberg]

### DMX Control
- Fixtures can now be deleted or moved to a different channel range [Morgan Rehnberg]

### InfoStation
- The button row is now scrollable for large numbers of buttons [Morgan Rehnberg]
- Change the size of buttons to fit your needs [Morgan Rehnberg]
- Better handling of images when they are larger than the text. [David Morgan]

### Media Browser
- New style options give you greater control over the look and feel of Media Browser [Morgan Rehnberg] 

### Word Cloud
- Support for using a hardware keyboard [Alex Averill]
- Limit the number of characters a response can be [Alex Averill]


# **Exhibitera 5**
Exhibitera 5 introduces a user account system that enables administrators to restrict access to various features. Divide responsibility while minimizing risk with granular permissions and improved logging.

## Hub

### General
- A new user account system for managing access to Exhibitera.
- Components can now be added to more than one group.

### Schedule
- Download schedules as CSV or JSON files.
- Create schedules from CSV or JSON files.

### Maintenance
- Assign issues to users.
- Track when the latest change to an issue was made and who made it.

## Exhibitera Apps

### General
- When creating or editing a definition, the preview can be configured for displays of different aspect ratios.
- Rich previews help you select the perfect font.

### InfoStation
- Control image sizing more precisely with support for Markdown image sizes.

### Media Browser
- Designate spreadsheet columns as filterable to allow users to sort the media collection.
- Redesigned lightbox allows media to be bigger.

### Media Player
- Create dynamic signage by annotating media with data from JSON files.
- Use media from URLs in addition to uploaded files.
