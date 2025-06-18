
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

interface ProductFormProps {
  onClose: () => void;
  existingData?: any;
}

const ProductForm: React.FC<ProductFormProps> = ({ onClose, existingData }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    name: existingData?.name || '',
    description: existingData?.description || '',
    price: existingData?.price || '',
    category: existingData?.category || '',
    stock_quantity: existingData?.stock_quantity || 0,
    image_url: existingData?.image_url || '',
    is_active: existingData ? existingData.is_active : true,
    group_discounts: existingData?.group_discounts || [
      { members: 2, discount: 10 },
      { members: 3, discount: 15 },
      { members: 5, discount: 20 }
    ],
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(existingData?.image_url || null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.image_url || null;
    
    const fileExt = imageFile.name.split('.').pop();
    const filePath = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(filePath, imageFile);
    
    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);
    
    return publicUrl;
  };

  const submitProductMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error('User not authenticated');
      
      // Upload image first
      const imageUrl = await uploadImage();
      
      const productData = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        price: parseFloat(form.price as string) || 0,
        category: form.category?.trim() || null,
        stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity as string) : null,
        image_url: imageUrl || null,
        group_discounts: form.group_discounts || [],
        is_active: true,
      };
      
      if (existingData) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', existingData.id);
        
        if (error) throw error;
      } else {
        // Insert new product
        const { error } = await supabase
          .from('products')
          .insert({
            ...productData,
            vendor_id: profile.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-products', profile?.id] });
      toast({
        title: existingData ? 'Product Updated' : 'Product Added',
        description: existingData 
          ? 'Your product has been updated successfully.' 
          : 'Your product has been added successfully.',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to ${existingData ? 'update' : 'add'} product. Please try again.`,
        variant: 'destructive',
      });
      console.error(error);
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    submitProductMutation.mutate();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ 
      ...prev, 
      [name]: type === 'number' ? (value ? parseFloat(value) : '') : value 
    }));
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="w-full md:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{existingData ? 'Edit Product' : 'Add New Product'}</SheetTitle>
          <SheetDescription>
            {existingData 
              ? 'Update your product details below.' 
              : 'Fill in the details for your new product.'}
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <div>
            <Label htmlFor="name">Product Name *</Label>
            <Input 
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Product Name"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea 
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Product Description"
              rows={4}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price *</Label>
              <Input 
                id="price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="stock_quantity">Stock Quantity *</Label>
              <Input 
                id="stock_quantity"
                name="stock_quantity"
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={handleChange}
                placeholder="0"
                required
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="category">Category</Label>
            <Input 
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="Product Category"
            />
          </div>
          
          <div>
            <Label htmlFor="product_image">Product Image</Label>
            <Input 
              id="product_image"
              name="product_image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
            />
            {imagePreview && (
              <div className="mt-2">
                <img 
                  src={imagePreview} 
                  alt="Product Preview" 
                  className="w-full max-h-48 object-contain rounded border"
                />
              </div>
            )}
          </div>

          {/* Group Discount Configuration */}
          <div>
            <Label>Group Shopping Discounts</Label>
            <p className="text-sm text-gray-600 mb-3">Set discounts for group orders (24-hour expiration)</p>
            <div className="space-y-3">
              {form.group_discounts.map((discount, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <Label className="text-xs">Members Required</Label>
                    <Input
                      type="number"
                      min="2"
                      value={discount.members}
                      onChange={(e) => {
                        const newDiscounts = [...form.group_discounts];
                        newDiscounts[index].members = parseInt(e.target.value) || 2;
                        setForm({ ...form, group_discounts: newDiscounts });
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Discount %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="50"
                      value={discount.discount}
                      onChange={(e) => {
                        const newDiscounts = [...form.group_discounts];
                        newDiscounts[index].discount = parseInt(e.target.value) || 0;
                        setForm({ ...form, group_discounts: newDiscounts });
                      }}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newDiscounts = form.group_discounts.filter((_, i) => i !== index);
                      setForm({ ...form, group_discounts: newDiscounts });
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setForm({
                    ...form,
                    group_discounts: [...form.group_discounts, { members: 2, discount: 10 }]
                  });
                }}
              >
                Add Discount Tier
              </Button>
            </div>
          </div>
          
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : existingData ? 'Update Product' : 'Add Product'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ProductForm;
