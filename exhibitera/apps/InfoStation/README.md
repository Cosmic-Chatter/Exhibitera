# InfoStation
InfoStation provides a touchscreen interface for creating digital labels. It supports text, images, and videos across multiple languages.

## Configuration

### Choosing hardware
InfoStation works best in **_Exhibitera's_** default, locally-installed mode. This means that it is best to run InfoStation on a Linux or Windows PC connected to the display that you want to use. 

Connecting to a remote instance (such as using an iPad) is supported, but, requires a stable network connection.

## Markdown basics

Text is formatted using [Markdown](https://www.markdownguide.org/basic-syntax/). Markdown is a powerful way of formatting text using simple symbols, but let's go over just a few of the basics.

Here is some simple text formatted with Markdown:

```md
# The Space Race
The Space Race was a competition between the United States and Soviet Union for scientific and technological preeminence in space that extended from the early 1950s until 1975.

![left](content/Sputnik.jpg "A model of the Sputnik 1 satellite.")

Milestones during the Space Race included the launch of **Sputnik 1** by the U.S.S.R in 1957, the landing of _Eagle_ on the surface of the Moon as part of **Apollo 11**, and the joint U.S.-U.S.S.R **Apollo-Soyuz Test Project** in 1975.

## First Steps
...
```
Markdown uses the `#` symbol to indicate headers. The headers get smaller as symbols are added, so `#` is a bigger header than `##` and so forth. Text is italicized by placing underscores around it (`_italics_`) and bolded using asterisks (`**bold**`).

InfoStation will break up the text into sections defined by top-level headers (`#`).

### Images
You can embed and place images following this pattern:

```md
![placement](file_path "Title")
```

 The title must be in quotes or left blank. Images should be uploaded as content and the `file_path` should begin with `content/`.

Here's an example:

```md
![right](content/FDR.jpg "Franklin Delano Roosevelt")
```

#### Controlling image placement

You can control the placement of an image by choosing one of `left`, `right`, or `full`. These apply different "container" sizes depending on whether InfoStation is in a landscape or portrait orientation.

| `placement` value | Orientation | Maximum image width |
| ----------------- | ----------- | ------------------- |
| `center` | Horizontal | 100% |
| `center` | Vertical | 100% |
| `left` | Horizontal | 35% |
| `left` | Vertical | 50% |
| `right` | Horizontal | 35% |
| `right` | Vertical | 50% |

#### Controlling image size
The default image sizes for each placement option will usually provide a good result, but you can also specify your image sizes more precisely using the pattern:

```md
![placement](file_path =WxH "Title")
```

There must be a space between the file path and the `=` and no spaces between the dimensions. Width (W) and height (H) can be specified in either pixels or percentages. If you use pixels, the image will be resized to exactly the size you give, up to the size of the container. If you use percentages, the image will be resized as a fraction of the container size.

**In order to maintain the correct aspect ratio, it's best to specify the width and use `*` for the height.** For example:

```md
![right](content/FDR.jpg =50%x* "Franklin Delano Roosevelt")
```

or 

```md
![left](content/FDR.jpg =250x* "Franklin Delano Roosevelt")
```

_Note that your display may not have the same pixel dimensions as the Exhibitera Apps setup preview, so specifying in pixel size may not be consistent across devices._