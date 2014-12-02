Annotation-Kit
==============
**Work in progress...**


## Shadow Remover Tool

Shadow Remover is a handy tool to quickly remove shadow from a window screenshot. It’s a great companion for anyone who is making documentation, writing articles or preparing presentations. By removing a shadow from your screenshot, it becomes more clear and less cluttered.

With this tool you could easily achieve the following result:

<img src="./docs/shadow_remover_result.png" width="728" height="286">

### How To Use

1. Make a Window Screenshot using standard `Ctrl+Shift+Cmd+4`, hover over a window and hit `Space`.
2. Paste it into the page.
3. Select resulting image layer.
4. Hit `Ctrl+A` to remove the shadow.

### Caution

Shadow remover works only with window screenshots that have a certain pattern of bitmap data. It tests several pixels for transparency and color components to be sure that the reference bitmap layer is actually a window screenshot.

The following pixel probes are used during screenshot validation:

<img src="./docs/shadow_remover_pixel_probes.png" width="728" height="446">

This means that Shadow Remover works only with window screenshots that have standard shape and shadow. Popover windows, menus and windows with custom shape are not supported.
