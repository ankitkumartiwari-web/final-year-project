import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader, OrbitControls } from 'three-stdlib';

interface ThreeDModelViewerProps {
  modelUrl: string;
}

export const ThreeDModelViewer: React.FC<ThreeDModelViewerProps> = ({ modelUrl }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4e8d0);

    // Get parent size
    const parent = mountRef.current;
    const width = parent?.clientWidth || 320;
    const height = parent?.clientHeight || 240;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    parent?.appendChild(renderer.domElement);

    // Add orbit controls for interactivity
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;

    const light = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
    scene.add(light);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf: any) => {
        scene.add(gltf.scene);
      },
      undefined,
      (error: any) => {
        console.error('Error loading 3D model:', error);
      }
    );

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      const newWidth = parent?.clientWidth || 320;
      const newHeight = parent?.clientHeight || 240;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      renderer.dispose();
      parent?.removeChild(renderer.domElement);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
    };
  }, [modelUrl]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
};
