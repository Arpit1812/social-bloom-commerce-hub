import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface VendorProductCardProps {
  product: {
    id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    category?: string;
    stock_quantity?: number;
    is_active?: boolean;
    created_at: string;
  };
  isOwner?: boolean;
  index?: number;
}

const VendorProductCard = ({ product, isOwner = false, index }: VendorProductCardProps) => {
  const navigate = useNavigate();

  const handleEdit = () => {
    navigate(`/products/${product.id}/edit`);
  };

  const handleViewProduct = () => {
    navigate(`/products/${product.id}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: index * 0.05 }}
      className="group relative w-full"
    >
      {/* Main Card Container */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-500 hover:shadow-2xl hover:shadow-pink-300/50 hover:scale-[1.02]">
        {/* Product Image */}
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
          <img
            src={
              product.image_url ||
              "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=500&h=600&fit=crop"
            }
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 cursor-pointer hover:scale-105"
            onClick={handleViewProduct}
            loading="lazy"
          />
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/30 to-transparent" />
          
          {/* Active Status Badge */}
          <div className="absolute top-3 left-3">
            <Badge 
              variant={product.is_active ? "default" : "secondary"}
              className={`px-3 py-1 text-sm font-semibold shadow-lg backdrop-blur-sm border-2 ${
                product.is_active 
                  ? "bg-green-500 hover:bg-green-600 text-white border-green-300" 
                  : "bg-red-500 hover:bg-red-600 text-white border-red-300"
              }`}
            >
              {product.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Content Area */}
        <div className="relative bg-white p-4 space-y-3">
          {/* Category and Status Row */}
          <div className="flex items-center justify-between">
            {product.category && (
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium bg-gray-100 px-2 py-1 rounded-md">
                {product.category}
              </span>
            )}
          </div>

          {/* Price and Stock */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">₹{product.price}</h2>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-600">Stock</div>
              <div className={`text-lg font-bold ${
                (product.stock_quantity || 0) > 10 
                  ? 'text-green-600' 
                  : (product.stock_quantity || 0) > 0 
                    ? 'text-orange-600' 
                    : 'text-red-600'
              }`}>
                {product.stock_quantity || 0}
              </div>
            </div>
          </div>

          {/* Product Name and Description */}
          <div className="space-y-2">
            <h3 
              className="text-lg font-semibold text-slate-800 leading-tight line-clamp-1 cursor-pointer hover:text-pink-600 transition-colors duration-200"
              onClick={handleViewProduct}
            >
              {product.name}
            </h3>
            <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
              {product.description || "No description available"}
            </p>
          </div>

          {/* Created Date */}
          <div className="text-xs text-slate-500">
            Created: {new Date(product.created_at).toLocaleDateString()}
          </div>

          {/* Action Buttons */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex gap-2">
              <Button
                onClick={handleViewProduct}
                variant="outline"
                className="flex-1 h-9 border-slate-300 hover:border-slate-400 text-sm"
              >
                <Package className="w-4 h-4 mr-1" />
                View Product
              </Button>
              {isOwner && (
                <Button
                  onClick={handleEdit}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white font-medium h-9 text-sm"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-500/5 to-rose-500/5 blur-xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  );
};

export default VendorProductCard; 