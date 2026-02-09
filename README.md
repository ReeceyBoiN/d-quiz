
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

  reece - Numbers questions on quiz packs dont always get marked correctly - some questions people answer correctly but it gets marked incorrect

  ?dax - Add the filter for questions so "THE LION KING" answer isnt a "T" as we're ignoring the word "THE" So for questions that may get added in the future, if the answer is "The Cat" then it should be the letter C as the correct answer. - In quiz pack mode, some questions will have the answer pre defined or marked in the question information, so that should also be taken into account, however if it is not already marked, the application should have this understanding built in to fall back on.

  reece - When a Teams Pic is sent from a teams phone, its not getting assigned to the team or coming through to host app. The team that uploads a picture should have that set as that teams picture until the quiz game has been fully reset with the "Empty Lobby".
  + + + + + Some folders are being created not in the main root folder, currently they are in (C:\Users\windows1\Documents\PopQuiz) which i think i want to move the whole root directory to that filepath anyways so filepath fix is on the to do list. - Guessing at the end as during builds it may cause an issue? Dax can you advise??

  reece - If a Team disconnects, The team in the teams list should go grey not just disapear from the teams list, so it indicates that a team has connected, still has points and all that teams info should still be stored incase they re connect, which i think parts of this function are already implimented but the team needs to be greyed out if they are not actively connected to the application.

  reece - Add buzzer folder audio folder for host and selection screen for players upon connecting

 x Scaling visually needs adding as its currently too cramped on the screen slightly whole software wide. 
 
 x Needs all visual elements reducing by 10% or so.

 x enforce demo mode into application to stop hosts from bypassing licence

 x activation needs to be assigned to a specific laptop / mac address so users cant log in, activate, then turn off wifi and log into another laptop to download same activation
 