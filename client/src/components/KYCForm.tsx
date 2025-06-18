
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';

interface KYCFormProps {
  onClose: () => void;
  existingData?: any;
}

const KYCForm: React.FC<KYCFormProps> = ({ onClose, existingData }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    business_name: existingData?.business_name || '',
    business_address: existingData?.business_address || '',
    gst_number: existingData?.gst_number || '',
    aadhar_number: existingData?.aadhar_number || '',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitKYCMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      if (!profile?.id) throw new Error('User not authenticated');
      
      if (existingData) {
        // Update existing KYC data
        const { error } = await supabase
          .from('vendor_kyc')
          .update({
            ...formData,
            status: 'pending',
            rejection_reason: null,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', existingData.id);
        
        if (error) throw error;
      } else {
        // Insert new KYC data
        const { error } = await supabase
          .from('vendor_kyc')
          .insert({
            vendor_id: profile.id,
            ...formData,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', profile?.id] });
      toast({
        title: 'KYC Submitted',
        description: 'Your KYC verification request has been submitted for review.',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to submit KYC. Please try again.',
        variant: 'destructive',
      });
      console.error(error);
    },
    onSettled: () => {
      setIsSubmitting(false);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    submitKYCMutation.mutate(form);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full md:max-w-md">
        <SheetHeader>
          <SheetTitle>KYC Verification</SheetTitle>
          <SheetDescription>
            Please provide your business details for verification.
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div>
            <Label htmlFor="business_name">Business Name *</Label>
            <Input 
              id="business_name"
              name="business_name"
              value={form.business_name}
              onChange={handleChange}
              placeholder="Your Business Name"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="business_address">Business Address *</Label>
            <Textarea 
              id="business_address"
              name="business_address"
              value={form.business_address}
              onChange={handleChange}
              placeholder="Complete Business Address"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="gst_number">GST Number (Optional)</Label>
            <Input 
              id="gst_number"
              name="gst_number"
              value={form.gst_number}
              onChange={handleChange}
              placeholder="GST Number"
            />
            <p className="text-sm text-gray-500 mt-1">
              Providing either GST or Aadhar number is recommended
            </p>
          </div>
          
          <div>
            <Label htmlFor="aadhar_number">Aadhar Number (Optional)</Label>
            <Input 
              id="aadhar_number"
              name="aadhar_number"
              value={form.aadhar_number}
              onChange={handleChange}
              placeholder="Aadhar Number"
            />
          </div>
          
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : existingData ? 'Resubmit' : 'Submit'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default KYCForm;
