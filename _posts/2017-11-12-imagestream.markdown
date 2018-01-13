---
date: "2017-11-12"
title: "Exporting external images to Openshift"
---

# Getting Started

First you need to have an Openshift installation on the cloud or in your machine, the second option is the easiest one thanks to the ```oc cluster up``` command, this will create a small local installation of openshift in your machine, if your are not familiar take a quick look at the [documentation](https://github.com/openshift/origin/blob/master/docs/cluster_up_down.md#getting-started).

# Creating a project

Once ```oc cluster up``` finish you should have an Openshift installation up and ready in your local machine, now next step is to login in and create a project.

```
oc login https://127.0.0.1:8443/  
oc new-project hello
```

The last command will create a project and will keep it as the one in use, so all commands will affect just hello project.

# Exporting your image

To import an image you run ```oc import-image``` this command will create a new image stream object pointing the image you want to use.

```
  oc import-image cvr-node:latest --from=docker.io/cvaldezr/nodejs --confirm
```

# Using the image
After successfully importing the image now is time to use it, so to demonstrate this let create a simple Pod object, with  a Node.js application.

First we need the URL of our ImageStream let get it by doing.

```
$ oc get is

NAME       DOCKER REPO                      TAGS      UPDATED
cvr-node   172.30.1.1:5000/hello/cvr-node   latest    39 seconds ago
```

Next let define our Pod, I want to create a simple app so I'm going to use the example Node.JS.

```yml
apiVersion: v1
kind: Pod
metadata:
  name: node-example
  labels:
    app: myapp
spec:
  containers:
  - name: myapp-container
    image: 172.30.1.1:5000/hello/cvr-node  # Our imported image
    command: ['/bin/sh', '-c']
    args:
    - cd /app/node-openshift-master/;
      echo folder:$PWD;
      npm install;
      nodemon $(node -e "console.log(require('./package.json').main)")


    volumeMounts:
    - mountPath: /app
      name: app-volume
    - mountPath: /.npm  
      name: npm-cache

    ports:
    - containerPort: 8080
  initContainers:
  - name: cloning  
    image: busybox
    command: ['/bin/sh', '-c']
    args:
    - cd /app/;
      wget -O src.zip https://github.com/cesarvr/node-openshift/archive/master.zip;
      unzip src.zip -d /app/;  
      rm src.zip;

    volumeMounts:
    - mountPath: /app
      name: app-volume
  volumes:
  - name: app-volume
    emptyDir: {}    
  - name: npm-cache
    emptyDir: {}   
```

We create the Pod

```sh
oc create -f node.yml  
```

After some initialization, assuming that everything is fine we should our Pod running, next thing is to expose it.

```sh
oc expose pod node-example
oc expose service node-example  
```

### Demo

<script type="text/javascript" src="https://asciinema.org/a/IJURr9cdQZTX1Q5Ue8jr1S3Zc.js" id="asciicast-IJURr9cdQZTX1Q5Ue8jr1S3Zc" async></script>







