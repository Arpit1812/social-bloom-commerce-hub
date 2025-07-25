
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';
import { Upload, FileCheck, AlertCircle, X } from 'lucide-react';

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
  const [gstDocument, setGstDocument] = useState<File | null>(null);
  const [aadharDocument, setAadharDocument] = useState<File | null>(null);
  const [gstPreview, setGstPreview] = useState<string | null>(existingData?.gst_url || null);
  const [aadharPreview, setAadharPreview] = useState<string | null>(existingData?.aadhar_url || null);
  const [uploadErrors, setUploadErrors] = useState<{gst?: string; aadhar?: string}>({});

  // File validation function
  const validateFile = (file: File): string | null => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    
    if (file.size > maxSize) {
      return 'File size must be less than 5MB';
    }
    
    if (!allowedTypes.includes(file.type)) {
      return 'Only PNG, JPEG, and PDF files are allowed';
    }
    
    return null;
  };

  // Upload file to Supabase storage
  const uploadDocument = async (file: File, documentType: 'gst' | 'aadhar'): Promise<string> => {
    if (!profile?.id) throw new Error('User not authenticated');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${profile.id}/${documentType}_${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(data.path);
    
    return publicUrl;
  };

  // GST document dropzone
  const onGstDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setUploadErrors(prev => ({ ...prev, gst: error }));
        return;
      }
      
      setUploadErrors(prev => ({ ...prev, gst: undefined }));
      setGstDocument(file);
      setGstPreview(URL.createObjectURL(file));
    }
  }, []);

  // Aadhaar document dropzone
  const onAadharDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setUploadErrors(prev => ({ ...prev, aadhar: error }));
        return;
      }
      
      setUploadErrors(prev => ({ ...prev, aadhar: undefined }));
      setAadharDocument(file);
      setAadharPreview(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps: getGstRootProps, getInputProps: getGstInputProps, isDragActive: isGstDragActive } = useDropzone({
    onDrop: onGstDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const { getRootProps: getAadharRootProps, getInputProps: getAadharInputProps, isDragActive: isAadharDragActive } = useDropzone({
    onDrop: onAadharDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const submitKYCMutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      if (!profile?.id) throw new Error('User not authenticated');
      
      // Validate that both documents are provided for new submissions
      if (!existingData && (!gstDocument || !aadharDocument)) {
        throw new Error('Both GST and Aadhaar documents are required');
      }
      
      // Upload documents if new files are selected
      let gstUrl = gstPreview;
      let aadharUrl = aadharPreview;
      
      if (gstDocument) {
        gstUrl = await uploadDocument(gstDocument, 'gst');
      }
      
      if (aadharDocument) {
        aadharUrl = await uploadDocument(aadharDocument, 'aadhar');
      }
      
      if (existingData) {
        // Update existing KYC data
        const { error } = await supabase
          .from('vendor_kyc')
          .update({
            ...formData,
            gst_url: gstUrl,
            aadhar_url: aadharUrl,
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
            gst_url: gstUrl,
            aadhar_url: aadharUrl,
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
            <Label htmlFor="gst_number">GST Number</Label>
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
            <Label htmlFor="aadhar_number">Aadhar Number</Label>
            <Input 
              id="aadhar_number"
              name="aadhar_number"
              value={form.aadhar_number}
              onChange={handleChange}
              placeholder="Aadhar Number"
            />
          </div>

          {/* GST Document Upload */}
          <div className="space-y-2">
            <Label>GST Document *</Label>
            <Card className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors">
              <CardContent className="p-0">
                <div
                  {...getGstRootProps()}
                  className={`p-6 cursor-pointer transition-colors ${
                    isGstDragActive ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <input {...getGstInputProps()} />
                  <div className="text-center space-y-2">
                    {gstPreview ? (
                      <div className="space-y-2">
                        <FileCheck className="w-8 h-8 mx-auto text-green-500" />
                        <p className="text-sm font-medium text-green-600">
                          GST Document Uploaded
                        </p>
                        {gstDocument && (
                          <p className="text-xs text-gray-500">{gstDocument.name}</p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGstDocument(null);
                            setGstPreview(null);
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">Upload GST Document</p>
                          <p className="text-xs text-gray-500">
                            Drag & drop or click to browse
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            PNG, JPEG, PDF (max 5MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            {uploadErrors.gst && (
              <div className="flex items-center gap-1 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {uploadErrors.gst}
              </div>
            )}
          </div>

          {/* Aadhaar Document Upload */}
          <div className="space-y-2">
            <Label>Aadhaar Document *</Label>
            <Card className="border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors">
              <CardContent className="p-0">
                <div
                  {...getAadharRootProps()}
                  className={`p-6 cursor-pointer transition-colors ${
                    isAadharDragActive ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                  }`}
                >
                  <input {...getAadharInputProps()} />
                  <div className="text-center space-y-2">
                    {aadharPreview ? (
                      <div className="space-y-2">
                        <FileCheck className="w-8 h-8 mx-auto text-green-500" />
                        <p className="text-sm font-medium text-green-600">
                          Aadhaar Document Uploaded
                        </p>
                        {aadharDocument && (
                          <p className="text-xs text-gray-500">{aadharDocument.name}</p>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAadharDocument(null);
                            setAadharPreview(null);
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 mx-auto text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">Upload Aadhaar Document</p>
                          <p className="text-xs text-gray-500">
                            Drag & drop or click to browse
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            PNG, JPEG, PDF (max 5MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            {uploadErrors.aadhar && (
              <div className="flex items-center gap-1 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {uploadErrors.aadhar}
              </div>
            )}
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
