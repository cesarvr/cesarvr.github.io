+++
date = "2015-10-09T20:33:08Z"
title = "Cordova Tips and Tricks"

+++



### Introduction

From a painful working experience with Cordova here some notes.


### Problems with input focus

- First check you have [ionic keyboard](https://www.npmjs.com/package/ionic-plugin-keyboard) installed.
- Put this in your config.xml.

  ```xml
    <preference name="KeyboardDisplayRequiresUserAction" value="false" />
  ```

<br>
### Can't find your files in IOS:
<br>
  Remember IOS file system is case sensitive.<br>
  ```sh
    myfile.txt !== MyFile.txt
  ```

<br>

### HTML5 Audio API Doesn't work in IOS:
User interaction is require, this means that if you don't interact with the UI the OS will mute the volume in your app, a quick workaround to avoid this is, when the user click just emit a low volume sound, this will unmute the mixer and you should be able to reproduce audio.   

### Touch response is slow:
<br>
[fast-click] Good library to solve the touch delay.

<br>
### Screen is jumping:

  IOS stop the Javascript execution until scroll has finish, sometimes you need to emulate the scroll to have full control over the UI this can be done by getting the [ionic keyboard](https://www.npmjs.com/package/ionic-plugin-keyboard) plugin and disable the native scroll.

  ```js
    window.cordova.plugins.Keyboard.disableScroll(true);
  ```

<br>

### If you need to emulate the scroll use IScroll:

  This is a very good library to emulate scrolling, you get a similar feeling than a native scroll but less performant.
  - [iscroll]

  ```js
   var iscroll = new IScroll('.content');
  ```
  If you are adding nodes to the DOM dynamically, you need to tell IScroll to update the geometry using the refresh() method.
  ```js

    //adding new stuff to the DOM. Ex $.append(el);
    iscroll.refresh();
  ```
  Beware of the padding in the div's, for some reason the whole div doesn't report the right height.

<br>

### Whitelisting network resource.

  - This plugin implements a whitelist policy for navigating the application webview on Cordova 4.0. [Whitelisting].  

<br>

[ionic keyboard]: https://github.com/driftyco/ionic-plugin-keyboard
[fast-click]: https://github.com/ftlabs/fastclick
[iscroll]: http://iscrolljs.com/
[whitelisting]: https://github.com/apache/cordova-plugin-whitelist
