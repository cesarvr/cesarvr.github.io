---
layout: post
date: "2017-11-12"
title: "Exporting external images to Openshift"
---

# Getting Started

First you need to have an Openshift installation on the cloud or in your machine, the second option is the easiest one thanks to the ```oc cluster up command.```, this will create a small local installation of openshift in your machine, if your are not familiar take a quick look at the [documentation](https://github.com/openshift/origin/blob/master/docs/cluster_up_down.md#getting-started).


# Creating a project

Once ```oc cluster up``` finish you should have an Openshift installation up and ready in your local machine, now next step is to login in and create a project.

```
oc login https://127.0.0.1:8443/  
oc new-project my-project
```

The last command will create a project and will keep it as the one in use so all commands will affect just my-project.


# Exporting your image

In this example we are going to import a lightweight NodeJS image [mhart/alpine-node](https://github.com/mhart/alpine-node), to import it we are going to use the following command.

```
oc import-image alpine-node:latest --from=registry.hub.docker.com/mhart/alpine-node --confirm
```

This command will grab the [mhart/alpine-node](https://github.com/mhart/alpine-node) base image form docker hub and will place it inside the Openshift private docker registry and made it available to the project.


```
oc run task --restart=Never --image=172.30.1.1:5000/my-project/alpine-node -- node -e "console.log('checking unit test: '); setTimeout(()=>console.log('...done'), 2000)   "
```
