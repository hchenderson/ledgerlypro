import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h2 className="text-2xl font-bold tracking-tight font-headline">Settings</h2>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>This is how others will see you on the site.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" defaultValue="Ledgerly User" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" defaultValue="user@example.com" />
                    </div>
                </CardContent>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Manage your billing and subscription.</CardDescription>
                </CardHeader>
                 <CardContent className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                        <p className="font-medium">You are on the <span className="text-primary font-bold">Yearly</span> plan.</p>
                        <p className="text-sm text-muted-foreground">Your plan renews on July 20, 2025.</p>
                    </div>
                     <Button variant="outline">Manage Billing</Button>
                </CardContent>
                <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                    <CardDescription>These actions are permanent and cannot be undone.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                     <div>
                        <p className="font-medium">Delete Account</p>
                        <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data.</p>
                    </div>
                    <Button variant="destructive">Delete Account</Button>
                </CardContent>
            </Card>

        </div>
    )
}
