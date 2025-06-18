
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";

interface InviteMembersDialogProps {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InviteMembersDialog = ({ groupId, groupName, open, onOpenChange }: InviteMembersDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [emails, setEmails] = useState<string[]>(['']);

  const inviteMutation = useMutation({
    mutationFn: async (emailList: string[]) => {
      const validEmails = emailList.filter(email => email.trim() && email.includes('@'));
      
      if (validEmails.length === 0) {
        throw new Error('Please enter at least one valid email address');
      }

      // Get the current user first
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('You must be logged in to send invites');
      }

      const invitePromises = validEmails.map(async (email) => 
        supabase
          .from('group_invites')
          .insert({
            group_id: groupId,
            invited_by: user.id,
            invited_email: email.trim()
          })
      );

      const results = await Promise.all(invitePromises);
      const errors = results.filter(result => result.error);
      
      if (errors.length > 0) {
        throw new Error(`Failed to send ${errors.length} invite(s)`);
      }

      return validEmails;
    },
    onSuccess: (sentEmails) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      toast({
        title: "Invites Sent!",
        description: `Successfully sent ${sentEmails.length} invite(s) to join ${groupName}.`,
      });
      setEmails(['']);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      setEmails(emails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleInvite = () => {
    inviteMutation.mutate(emails);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Members to {groupName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Label>Email Addresses</Label>
          {emails.map((email, index) => (
            <div key={index} className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => updateEmail(index, e.target.value)}
                placeholder="Enter email address"
                className="flex-1"
              />
              {emails.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeEmailField(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          
          <Button
            type="button"
            variant="outline"
            onClick={addEmailField}
            className="w-full"
          >
            Add Another Email
          </Button>
          
          <div className="flex gap-2">
            <Button
              onClick={handleInvite}
              disabled={inviteMutation.isPending}
              className="flex-1 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
            >
              <Send className="w-4 h-4 mr-2" />
              {inviteMutation.isPending ? 'Sending...' : 'Send Invites'}
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-pink-200 text-pink-600 hover:bg-pink-50"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InviteMembersDialog;
