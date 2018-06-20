
#### Mounting file system into our container

But happiness is not complete yet, if we run our contained process and run ```ps``` look what we found.

```
PID TTY          TIME CMD
```

It seems that we don't have any process running, the problem is that when we change the root folder, we stop using the global ```/proc``` directory and our child process is using the empty one available in the distribution, this directory is the place where Linux mounts the **procfs** pseudo-filesystem.

##### Reusability Lesson

The [procfs](https://en.wikipedia.org/wiki/Procfs) filesystem doesn't represent a part of your disk or any storage at all, Linux follows the Unix principle of "everything is a file", so instead of creating new interfaces to share information they use the folder/files metaphors to communicate information to the user.

##### Mounting Procfs

The system call [mount](http://man7.org/linux/man-pages/man2/mount.2.html) our call will look like this:

```cpp
mount("proc", "/proc", "proc", 0, 0);
```
This method receive the resource we want to mount, the we pass the folder pointing to the ```/proc``` folder and the filesystem type which is ```proc```.  

```cpp
createChild([](void *args) -> int {
      #...
      chdir("/"); // point to root folder /.
      sethostname(hostname.c_str(), hostname.size());

      mount("proc", "/proc", "proc", 0, 0);

      execvp({"/bin/sh"}, {});
  }, CLONE_NEWUTS | CLONE_NEWPID | SIGCHLD);
```

We compile and run our program and then we run ``` ps ```.

```
process created with pid: 8238
current process id: 1
/ # ps
PID   USER     TIME   COMMAND
    1 root       0:00 /bin/sh
    2 root       0:00 ps
```

If we pay close attention we see that this process tree looks unique to our context, this is because now we are noticing the full effect off having assigned to our child process a new process tree as we did above by using the flag ``` CLONE_NEWPID ```.


##### Conclusion 









