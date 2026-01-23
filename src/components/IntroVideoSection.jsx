import { useState, useEffect } from 'react';
import { Play, X, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

export default function IntroVideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isPlaying) {
        setIsPlaying(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isPlaying]);

  const handlePlayVideo = () => {
    setIsPlaying(true);
  };

  const handleCloseVideo = () => {
    setIsPlaying(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <>
      {/* Video Preview Section */}
      <section className="container mx-auto px-4 py-20 scroll-reveal">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="hero-badge mb-6">
              <Play size={16} />
              <span className="font-medium">See Prism in Action</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
              Watch How Teams Build Better AI Workflows
            </h2>
            <p className="text-lg" style={{ color: 'var(--muted-foreground)' }}>
              A quick 2-minute walkthrough of Prism's core features
            </p>
          </div>

          {/* Video Thumbnail */}
          <div 
            className="capsule-card cursor-pointer group relative"
            onClick={handlePlayVideo}
            style={{
              aspectRatio: '16/9',
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Gradient Background */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(167, 139, 250, 0.08) 100%)',
              }}
            />

            {/* Overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at center, transparent 0%, rgba(10, 13, 20, 0.7) 100%)',
              }}
            />

            {/* Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                style={{
                  background: 'var(--primary)',
                  boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4)',
                }}
              >
                <Play size={32} fill="white" color="white" className="ml-1" />
              </div>
            </div>

            {/* Video Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                  }}
                >
                  2:30
                </div>
                <span className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                  Product Demo
                </span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-white">
                From Zero to Productive in Minutes
              </h3>
            </div>

            {/* Decorative Glow Effects */}
            <div 
              className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full opacity-20 pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            <div 
              className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full opacity-20 pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
          </div>

          {/* Key Points Grid */}
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              { label: 'Quick Setup', value: '< 1 min' },
              { label: 'Team Collaboration', value: 'Real-time' },
              { label: 'AI Integration', value: 'Built-in' },
            ].map((item, index) => (
              <div 
                key={index}
                className="text-center p-4 rounded-xl glass-card"
                style={{
                  background: 'rgba(139, 92, 246, 0.05)',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                }}
              >
                <div className="text-2xl font-bold mb-1" style={{ color: 'var(--primary)' }}>
                  {item.value}
                </div>
                <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Modal */}
      {isPlaying && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out',
          }}
          onClick={handleCloseVideo}
        >
          <div 
            className={`relative ${isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video Controls Bar */}
            <div 
              className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10"
              style={{
                background: 'linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, transparent 100%)',
              }}
            >
              <h3 className="text-white font-semibold">Prism Product Demo</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="action-btn-premium"
                  style={{ 
                    width: '40px', 
                    height: '40px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white'
                  }}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="action-btn-premium"
                  style={{ 
                    width: '40px', 
                    height: '40px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white'
                  }}
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
                <button
                  onClick={handleCloseVideo}
                  className="action-btn-premium"
                  style={{ 
                    width: '40px', 
                    height: '40px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: 'white'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Video Container */}
            <div 
              className={`${isFullscreen ? 'h-full' : 'aspect-video'} rounded-lg overflow-hidden`}
              style={{
                background: 'black',
                border: '1px solid rgba(139, 92, 246, 0.2)',
              }}
            >
              {/* Replace src with your actual  video URL */}
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=${isMuted ? 1 : 0}`}
                title="Prism Demo Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* Close Hint */}
            <div className="text-center mt-4">
              <p className="text-sm" style={{ color: 'rgba(228, 228, 231, 0.6)' }}>
                Press ESC or click outside to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
