---
date: "2018-05-22"
title: "How Linux Containers Works"
layout: post
---

# How Linux Containers Works

Containers is one of the hottest technologies at the moment, but sometimes they are misunderstood, so inspired by the [talk](https://www.ustream.tv/embed/recorded/102859668) of [Liz Rice](https://twitter.com/lizrice) about the technology behind containers. I decided to write a post about the steps involved in the container creation in the hope that help people create maybe a better definition of what a container is.


## Linux process

A process in simple terms is just the instantiation of binary code usually a program into the memory.

Basically you have some code, in this case I'll use C++.

```c++
#include <iostream>
using namespace std;

int main(int argc, char* argv[]){
  cout << "Hello World" << endl;
  return 0;
}
```

You compile this code into a binary, I'll choose an original name, let's call it container.

```sh
g++ container.cc -o container  
```

Now let's create the process.

```sh
./container   
```

The process will get instantiated, execute the instruction to pass some words to the Linux kernel and this will outputted into the console and exit.

```sh
# Hello World!
```

## Child processes

One of the features of Linux (and the majority of commercial OS) is that process can have children's which is a one way to achieve multitasking, in this case we are going to extend our program to run a simple child process.

```c++
template<typename AnonymousFunction>
void createChildProcess(AnonymousFunction &&action, int flags) {
  auto pid = clone(action, allocStackMemory(), flags, 0);
  #...
  waitForChilds();
}

int main(int argc, char* argv[]){
  cout << "Hello World (from parent)"
  createChildProcess( [](void *args) -> int {
    cout << " Hello World (from child)" << endl;
  }, SIGCHLD);

  return 0;
}
```

Let's explain some of the changes here the changes here:

```
[](void *args) -> int {

}
```
Don't be afraid by that incantation, is just an [Anonymous functions](https://en.wikipedia.org/wiki/Anonymous_function), in C++ they are called lambda expressions.

```cpp
template<typename AnonymousFunction>
void createChildProcess(AnonymousFunction &&action, int flags) {
  auto pid = clone(action, allocStackMemory(), flags, 0);
  #...

}
```

Here we just created a function (createChildProcess) that receive a function, creates a *child* by cloning the actual process and continue child execution in parallel.

```cpp
void createChildProcess(AnonymousFunction &&action, int flags) {
  #...
  waitForChilds();
}
```

This just stop the parent process until the child finish.


If you re-run this program you'll get.

```sh

./container
#Hello World (from parent)
#Hello World (from child)
```

## Fake it until you make it

#### Executing our child program
Let's start our virtualization journey, first of all let run something inside our child process.   

```
createChild([](void *args) -> int {
    run(0,"/bin/bash");
}, SIGCHLD);
```

Now we created bash as our child process, if we execute our program we should got this.

```
process created with pid: 12406
sh-4.4$
```


#### Isolating the environment variables

first we going to start with some simple isolation like environment variables, if you run ``` env ``` right know you would see that we are inheriting our parent process env vars let solve that problem.

```cpp
createChild([](void *args) -> int {
    clearenv();
    run(0,"/bin/bash");
}, SIGCHLD);
```
That was easy, we are clearing the vars before start but hey, its a good start.


#### Isolating the Universal Time System (UTS)

Next we are going to isolate the Universal Time Sharing (UTS) feature in Linux,  basically we are going to make our process believe he is working in other machine at least from the point of view of its Hostname.

We are going to achieve this by adding a new flag through our beautiful high level interface ```createChild```, this flag is called ```CLONE_NEWUTS```, it tell the Kernel that we also want to assign a cloned UTS for our chilld process.  

```cpp
createChild([](void *args) -> int {
    clearenv();
    run(0,"/bin/bash");
}, CLONE_NEWUTS | SIGCHLD);
```

Now lets proof our hypothesis, the first thing we need is to recompile and execute our program.

```
./container                                                     
error: clone(): Operation not permitted
```

This happens because what we try to do (cloning the UTS namespace) require elevated privilege.

```
sudo ./container                                      
[sudo] password for cesar:
process created with pid: 12906
sh-4.4#
```

It works and now you can change the hostname inside your isolate space.

 ```
 sh-4.4# hostname my-container
 ```
And you will see, that this change only affect the lifetime of the bash process which at the same time is the lifetime of our process tree, outside everything stay the same.

[video here]()

#### Making our process the only one.  

Each time you execute a program in Linux the system grant this process and id and then attach if your process do not have any parent it get attached to the initial process which has PID number one, we can consider this the parent of all the process in the system, so our next virtualization step is to make our process believe he is running alone in the machine, we are going to make our process the number one.

 This one is easy we just need to add a flag to clone so our process get its own PID tree, separated from the rest.

 ```cpp
 createChild([](void *args) -> int {
    cout << "current process id: " << getpid() << endl;

    clearenv();
    string hostname = "my-container";
    sethostname(hostname.c_str(), hostname.size());
    run(0,"/bin/sh");

  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
 ```

The important thing here is to check ```CLONE_NEWPID``` this will give our process a new tree making it feel unique. To test this hypothesis I added this:

```cpp
 createChild([](void *args) -> int {
  cout << "current process id: " << getpid() << endl;
```

This will print the PID of the process in after it get cloned. And as we expected we should see:

```sh
sudo ./container                              
process created with pid: 2045 # this one belong to container.
current process id: 1 # this one belong to the Anonymous Function.
sh-4.4#
```

But happiness is not complete yet, if we run our contained process and run ```ps``` look what we found.

```
PID TTY          TIME CMD
2747 pts/0    00:00:00 sudo
2748 pts/0    00:00:00 container
2749 pts/0    00:00:00 sh
2751 pts/0    00:00:00 ps
```

This is a leak from our guest and basically a demonstration that our containment is not good enough in the next chapter we'll to fix that.  


#### Changing the root folder

Our new objective is to contain the access to the files our process can access, to achieve that, we are going to get the typical base folder install for Alpine Linux a very lightweight distribution.

First we need to download the base Linux installation, for this chapter we are going to use the one from this project [Alpine Linux Project](https://github.com/yobasystems/alpine) and we need to download the [tar/gz](alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz) with the base installation.


```
mkdir root && cd root
curl -Ol http://nl.alpinelinux.org/alpine/v3.7/releases/x86_64/alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
tar -xvf alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
rm alpine-minirootfs-3.7.0_rc1-x86_64.tar.gz
```

Now we are going to change our code.

```cpp
createChild([](void *args) -> int {
      cout << "current process id: " << getpid() << endl;
      string hostname = "my-container";

      clearenv();
      chroot("./root");
      //mount("proc", "/proc", "proc", 0, 0);
      putenv((char *)"PATH=/bin");

      sethostname(hostname.c_str(), hostname.size());
      run(0,"/bin/sh");

  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
```
