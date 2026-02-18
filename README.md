
  # Quiz 5 - Reece - Ready

Action	Command
First setup	- npm ci
After pulling updates -	npm ci
Add new package -	npm - install pkg-name --save-exact (then commit lock file)
Never use	- npm install (without lock file strict mode)

First Time Instructions for player app:
Get your IP from CMD (ipconfig) then on a phone on the same wifi network, enter your IPv4 followed by ":4310" as thats the port.


    Fixes Needed:

  dax - Livescreen needs to be able to be moved and also closed when the livescreen box / button gets un-ticked in the host app.

  ?dax - Add the filter for questions so "THE LION KING" answer isnt a "T" as we're ignoring the word "THE" So for questions that may get added in the future, if the answer is "The Cat" then it should be the letter C as the correct answer. - In quiz pack mode, some questions will have the answer pre defined or marked in the question information, so that should also be taken into account, however if it is not already marked, the application should have this understanding built in to fall back on.

  change teams layout button on bottom navigation bar changes the size of the navigation bar when toggled. - Visually the boxes and placement and if text changes it shouldnt change location of boxes buttons and interface, unless its font size, that should increase everything all round really.

  host controller button on bottom navigation bar should go green if the host has connected with that 4 diget code as their team name, that code is dynamic and private and lets the host connect and control the software from a mobile device whilst so they can start timers submit questions etc from a player web portal device if they have that 4 diget code as a team name

  Instructions graphics need making, how to play, how to connect, how to answer, how to edit team name, add a team pic, letters questions etc etc

  Buzz in mode needs just making in general hahah

  team grid needs to be smaller when viewing the teams info when clicking on a team from the teams list

  clicking on the no wifi connected button should provide troubleshooting steps and tools

  The no wifi button is currently just for visual effect and not connected to anything on the backend

  in settings, external screen settings should have individual controlls to increase / decreas the size of the text 

  in setting, external screen, could do with removing the countdown timer style. easier to base the UI with a fixed timer countdown so 
  kill all the other timer designs

  Multiple choice questions when being displayed on the external display arent showing the options to choose from, only the main question text

  in setting, Waiting room should have an option to enforce a password to connect, this function is so hosts can charge teams individually and if a team doesnt pay, the host wont type in the password (can be a 4 digit pin system)

  in settings, waiting room should have the ability to display waiting room images.

  x Scaling visually needs adding as its currently too cramped on the screen slightly whole software wide. 
 
  x Needs all visual elements reducing by 10% or so.

  x enforce demo mode into application to stop hosts from bypassing licence

  x activation needs to be assigned to a specific laptop / mac address so users cant log in, activate, then turn off wifi and log into another laptop to download same activation