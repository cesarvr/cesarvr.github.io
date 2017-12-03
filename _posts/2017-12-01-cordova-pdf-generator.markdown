---
layout: post
date: "2017-12-01T19:51:38Z"
title: "How to generate a PDF Documents using Cordova, for Android and IOS"
---

### Why 

Some of my work at Red Hat is to desing and develop end-to-end mobile/desktop application using Apache Cordova and using Node.JS, One of the typical challenges I face, when working with some costumer, is how to generate reports in PDF format, the usual way to solve this was to use a server side API render the document there and send it to the phone, this is not nice, the first reason, you need network connectivity for this to work, the second is the lack of good and free PDF API's in the server side, so I decide to write a plugin to move this job to the mobile device, the advantages of doing this are:

- You can use this functionality off-line. 
- The user has more control over the experience. 
- Share the document across apps (Print, email, other apps). 
- Offloading task from the server.

### How it works

So basically to make this easy I wanted to use HTML/CSS as the template engine, so you can use this familiar markup languages to defined how your PDF is going to look, then I load this inside on a offscreen Webkit provided by the target OS and print it.

### Quick demo

Assuming you have installed last version of Cordova, let try to write a simple example for both plaftforms.

```sh
cordova create hello-pdf   # this will create a new cordova project 

# initializing both platforms
cordova platform add ios  # Make sure you installed XCode
cordova platform add android  # Make sure you have Android Studio

# installing the plugin
cd ./hello-pdf/
cordova plugin add cordova-pdf-generator
```

Now we need to do some coding to create our PDF, to start we need to open with our favorite editor the entry file in ``` ./hello-pdf/www/index.js  ``` , once we open it we should have something like this.    

```js
var app = {
    // Application Constructor
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {
        this.receivedEvent('deviceready');
    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};

app.initialize();
```

We need to go to the function ```receivedEvent``` this function will be called after cordova is done initializing the framework, so its the place where we should put our code.

```js
var app = {
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        // Our code start here 
        var opts = {
            type: "share",          //Open a context menu and ask the user what to do next (print, mail, etc..).
            fileName: 'v8-tutorial.pdf' //it will use this filename as a place-holder
        }
        
        pdf.fromURL('http://cesarvr.github.io/2015/11/20/javascript-v8.html'
                opts)
        .then((status) => console.log('success->', status))
        .catch((error) => console.log(error));

        // End here

        console.log('Received Event: ' + id);
    }
};

app.initialize();
```

We run this by doing: 

```sh
cordova prepare

# To deploy in Android 
cordova run android 

# To deploy in iOS 
cordova run ios 
```
![snapshot](/static/adb-snapshot.png "Logo Title Text 1")

We should see our beautiful PDF being generated for us, as you can see we use the option ```{type: 'share'}```, this mean it will popup a contextual menu with some helpful options, this is a good choice if you want your app to integrate with the OS ecosystem, or to give the option to the user to manipulate the PDF. 

Also if you just want to have control over the document, you can use the option ```{type: 'base64'}``` this will transform it to a base64 string that you can upload to a server or display it using your own library.

If you need more info you can find it in the [documentation](https://www.npmjs.com/package/cordova-pdf-generator), also this [demo](https://github.com/cesarvr/pdf-generator-example) capture some the typical use cases.

If you want to contribute here is the [Github](https://github.com/cesarvr/pdf-generator) repository.  

