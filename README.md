
  # Quiz 5 - Reece - Ready

Action	Command
First setup	- npm ci
After pulling updates -	npm ci
Add new package -	npm - install pkg-name --save-exact (then commit lock file)
Never use	- npm install (without lock file strict mode)

First Time Instructions for player app:
Get your IP from CMD (ipconfig) then on a phone on the same wifi network, enter your IPv4 followed by ":4310" as thats the port.


    Fixes Needed:

  Hide question should also act like send question by progressing to the next stage of asking the question and should show the next buttons for start timer and silent timer, rather than just the hide question button toggling the view and needing to then ALSO click send question to proceed to the next stage. So the hide question button works correctly by not displaying the question on the player device or livescreen, it just doesnt progress to the next stage of the question like clicking the "Send Question" button does.

  pictures when sent to the phone need to be clickable to disapear rather than show above the options, currently when a picture question is loaded up through quizpack mode, on the player device it shows the picture above the answer entry / keypad on the player devices, when in reality, the picture should take up the full screen of the players device main area ontop of the answer option keypad but once the picture is clicked it should disappear to show the answer options below it so people can choose to look at the picture for however long they want before tapping it to bring up their keypad to submit an answer.

  On the trigger for "Reveal Answer" in any game mode, so thats quiz pack mode AND on the spot keypad modes as well, sound needs to be mapped in the files for applause if any team has answered correctly, it plays one of the audio files in the folder:"C:\PopQuiz\d-quiz\resorces\sounds\Applause", it can choose any of those at random in that folder but if no teams answer correctly, it should play a sound from this folder filepath instead: "C:\PopQuiz\d-quiz\resorces\sounds\Fail Sounds" again it should be a random file chosen in that folder. One folder is marked Applause and a random audio file in there should be played once the "reveal answer" is triggered in any game mode if ANY team has answered correctly, if 0 teams have answered correctly then one of the audio files from the fail sounds folder should be played once the "reveal answer" is triggered.

  Add the filter for questions so "THE LION KING" answer isnt a "T" as we're ignoring the word "THE" So for questions that may get added in the future, if the answer is "The Cat" then it should be the letter C as the correct answer. - In quiz pack mode, some questions will have the answer pre defined or marked in the question information, so that should also be taken into account, however if it is not already marked, the application should have this understanding built in to fall back on.

  When a Teams Pic is sent from a teams phone, its not getting assigned to the team or coming through to host app. The team that uploads a picture should have that set as that teams picture until the quiz game has been fully reset with the "Empty Lobby".

  If a Team disconnects, The team in the teams list should go grey not just disapear from the teams list, so it indicates that a team has connected, still has points and all that teams info should still be stored incase they re connect, which i think parts of this function are already implimented but the team needs to be greyed out if they are not actively connected to the application.

 x Scaling visually needs adding as its currently too cramped on the screen slightly whole software wide. 
 
 x Needs all visual elements reducing by 10% or so.

 x enforce demo mode into application to stop hosts from bypassing licence

 x activation needs to be assigned to a specific laptop / mac address so users cant log in, activate, then turn off wifi and log into another laptop to download same activation