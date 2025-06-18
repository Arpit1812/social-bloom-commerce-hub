
import { Button } from "@/components/ui/button";
import { Users, ShoppingBag, Share } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-white to-rose-50"></div>
      <div className="absolute top-20 left-10 w-32 h-32 bg-pink-200 rounded-full opacity-20 animate-float"></div>
      <div className="absolute bottom-20 right-10 w-24 h-24 bg-rose-200 rounded-full opacity-20 animate-float" style={{animationDelay: '1s'}}></div>
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
            Shop, Share, and 
            <span className="gradient-text"> Connect</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 animate-slide-up">
            The social e-commerce platform where communities come together to discover, share, and shop their favorite products with friends and family.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-slide-up" style={{animationDelay: '0.2s'}}>
            <Button 
              size="lg" 
              onClick={() => navigate("/products")}
              className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-lg px-8 py-4"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Start Shopping
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={() => navigate("/groups")}
              className="social-button border-pink-200 text-pink-600 hover:bg-pink-50 text-lg px-8 py-4"
            >
              <Users className="w-5 h-5 mr-2" />
              Create Group
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
            <div className="smooth-card p-8 floating-card animate-slide-up" style={{animationDelay: '0.4s'}}>
              <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Social Shopping</h3>
              <p className="text-gray-600">Share your favorite finds with friends and discover new products through your social network.</p>
            </div>
            
            <div 
              className="smooth-card p-8 floating-card animate-slide-up cursor-pointer hover:scale-105 transition-transform duration-300" 
              style={{animationDelay: '0.6s'}}
              onClick={() => navigate("/groups")}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Private Groups</h3>
              <p className="text-gray-600">Create exclusive shopping groups for specific brands and invite your closest friends and family.</p>
            </div>
            
            <div 
              className="smooth-card p-8 floating-card animate-slide-up cursor-pointer hover:scale-105 transition-transform duration-300" 
              style={{animationDelay: '0.8s'}}
              onClick={() => navigate("/products")}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Easy Ordering</h3>
              <p className="text-gray-600">Order products directly from your groups with quantity selection and seamless checkout.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
