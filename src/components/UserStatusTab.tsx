import { useAuth } from "../utils/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { User, Mail, Wifi, WifiOff, Clock, Shield, LogOut, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner@2.0.3";

export function UserStatusTab() {
  const { user, isLoggedIn, logout, isOnline, quizActivated, setQuizActivated } = useAuth();

  const handleLogout = () => {
    logout();
    toast.success("Successfully logged out");
  };

  const toggleQuizActivation = () => {
    setQuizActivated(!quizActivated);
    toast.success(quizActivated ? "Quiz deactivated" : "Quiz activated");
  };

  const formatLoginTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!isLoggedIn) {
    return (
      <div className="p-6 space-y-6">
        <Card className="border-border">
          <CardHeader className="text-center pb-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Not Logged In</CardTitle>
            <CardDescription>
              Please log in to access your account status and quiz controls
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm mb-4">
              Click the user icon in the top navigation to sign in to your account.
            </p>
            <Badge variant="outline" className="text-muted-foreground">
              Guest Mode
            </Badge>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 flex gap-6">
      {/* Left Column - User Information */}
      <div className="w-1/2">
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  Welcome back, {user.firstName || user.email.split('@')[0]}
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </CardTitle>
                <CardDescription>Logged in successfully</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email Address</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Login Time</p>
                <p className="text-sm text-muted-foreground">{formatLoginTime(user.loginTime)}</p>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="w-full flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - System Status */}
      <div className="w-1/2 space-y-6">
        {/* Connection Status Card */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              System Status
            </CardTitle>
            <CardDescription>
              Monitor your connection and quiz system status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Internet Connection */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-500" />
                )}
                <div>
                  <p className="text-sm font-medium">Internet Connection</p>
                  <p className="text-sm text-muted-foreground">
                    {isOnline ? "Connected" : "Disconnected"}
                  </p>
                </div>
              </div>
              <Badge 
                variant={isOnline ? "default" : "destructive"}
                className={isOnline ? "bg-green-500 hover:bg-green-600" : ""}
              >
                {isOnline ? "Online" : "Offline"}
              </Badge>
            </div>

            <Separator />

            {/* Quiz Activation Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${
                    quizActivated 
                      ? "bg-green-500 shadow-lg animate-pulse" 
                      : "bg-gray-400"
                  }`} />
                  <div>
                    <p className="text-sm font-medium">Quiz System</p>
                    <p className="text-sm text-muted-foreground">
                      {quizActivated ? "Active and ready" : "Inactive"}
                    </p>
                  </div>
                </div>
                <Badge 
                  variant={quizActivated ? "default" : "secondary"}
                  className={`${
                    quizActivated 
                      ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30" 
                      : ""
                  }`}
                >
                  {quizActivated ? "ACTIVE" : "INACTIVE"}
                </Badge>
              </div>
              
              <Button 
                variant={quizActivated ? "destructive" : "default"}
                size="sm"
                onClick={toggleQuizActivation}
                className={`w-full ${
                  quizActivated 
                    ? "" 
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                {quizActivated ? (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Deactivate Quiz
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Activate Quiz
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Additional Status Information */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-lg font-medium text-primary">
                  {Math.floor((Date.now() - user.loginTime.getTime()) / (1000 * 60))}
                </p>
                <p className="text-xs text-muted-foreground">Minutes Online</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-lg font-medium text-primary">
                  Standard
                </p>
                <p className="text-xs text-muted-foreground">User type</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-lg font-medium text-primary">
                  47
                </p>
                <p className="text-xs text-muted-foreground">Total Quiz Activations</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-lg font-medium text-primary">
                  126h 34m
                </p>
                <p className="text-xs text-muted-foreground">Total Time Quiz Hosting</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-lg font-medium text-primary">
                  Mar 15, 2024
                </p>
                <p className="text-xs text-muted-foreground">Account Creation Date</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-lg font-medium text-primary">
                  8,492
                </p>
                <p className="text-xs text-muted-foreground">Online Token Count</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}