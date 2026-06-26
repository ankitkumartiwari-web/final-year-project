import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader, OrbitControls } from 'three-stdlib';

interface ThreeDModelViewerProps {
  modelUrl: string;
  title?: string;
  subtitle?: string;
}

export const ThreeDModelViewer: React.FC<ThreeDModelViewerProps> = ({
  modelUrl,
  title,
  subtitle,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setStatus('loading');

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xe8d8b5, 18, 42);

    // Get parent size
    const parent = mountRef.current;
    const width = parent?.clientWidth || 320;
    const height = parent?.clientHeight || 240;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 4.5, 12);
    camera.lookAt(0, 2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    parent?.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.45;
    controls.minPolarAngle = Math.PI / 4.2;
    controls.maxPolarAngle = Math.PI / 1.85;
    controls.target.set(0, 1.8, 0);

    const hemisphereLight = new THREE.HemisphereLight(0xfff4d6, 0x5b4126, 1.8);
    scene.add(hemisphereLight);

    const keyLight = new THREE.DirectionalLight(0xfff0c2, 2.6);
    keyLight.position.set(8, 14, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -12;
    keyLight.shadow.camera.right = 12;
    keyLight.shadow.camera.top = 12;
    keyLight.shadow.camera.bottom = -12;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbfd8ff, 1.3);
    rimLight.position.set(-10, 6, -8);
    scene.add(rimLight);

    const ambientFill = new THREE.PointLight(0xffc876, 25, 30, 2);
    ambientFill.position.set(0, 3, 6);
    scene.add(ambientFill);

    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(5.4, 6.2, 0.85, 48),
      new THREE.MeshStandardMaterial({
        color: 0x6a4323,
        roughness: 0.92,
        metalness: 0.08,
      })
    );
    stage.receiveShadow = true;
    stage.position.set(0, -0.45, 0);
    scene.add(stage);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(12, 64),
      new THREE.ShadowMaterial({ opacity: 0.2 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    let activeModel: THREE.Object3D | null = null;
    let animationFrameId = 0;

    const frameModel = (root: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const fitScale = 5.5 / maxDim;

      root.scale.setScalar(fitScale);

      const scaledBox = new THREE.Box3().setFromObject(root);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      const scaledSize = scaledBox.getSize(new THREE.Vector3());

      root.position.x += -scaledCenter.x;
      root.position.y += -scaledBox.min.y + 0.12;
      root.position.z += -scaledCenter.z;

      controls.target.set(0, Math.max(1.2, scaledSize.y * 0.33), 0);

      const distance = Math.max(7.5, scaledSize.length() * 1.05);
      camera.position.set(distance * 0.1, Math.max(4, scaledSize.y * 0.7), distance);
      controls.minDistance = Math.max(5.5, distance * 0.72);
      controls.maxDistance = Math.max(10, distance * 1.3);
      camera.lookAt(controls.target);
    };

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf: any) => {
        activeModel = gltf.scene;

        activeModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (Array.isArray(child.material)) {
              child.material.forEach((material) => {
                material.needsUpdate = true;
              });
            } else if (child.material) {
              child.material.needsUpdate = true;
            }
          }
        });

        frameModel(activeModel);
        scene.add(activeModel);
        setStatus('ready');
      },
      undefined,
      (error: any) => {
        console.error('Error loading 3D model:', error);
        setStatus('error');
      }
    );

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (activeModel) {
        activeModel.rotation.y += 0.0015;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const newWidth = parent?.clientWidth || 320;
      const newHeight = parent?.clientHeight || 240;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      parent?.removeChild(renderer.domElement);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    };
  }, [modelUrl]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% 20%, rgba(255, 245, 214, 0.95), rgba(232, 216, 181, 0.78) 38%, rgba(120, 73, 36, 0.7) 100%),
            linear-gradient(180deg, rgba(255,255,255,0.15), rgba(78,45,18,0.32))
          `,
        }}
      />
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {(title || subtitle) && (
        <div className="pointer-events-none absolute left-4 right-4 top-4 z-10">
          <div className="rounded-md border border-amber-100/25 bg-stone-950/22 px-3 py-2 backdrop-blur-sm">
            {title && <p className="text-[11px] uppercase tracking-[0.28em] text-amber-100/80">{title}</p>}
            {subtitle && <p className="mt-1 text-xs text-amber-50/90">{subtitle}</p>}
          </div>
        </div>
      )}

      {status !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-stone-950/15 backdrop-blur-[2px]">
          <div className="rounded-full border border-amber-100/30 bg-stone-950/35 px-4 py-2 text-xs uppercase tracking-[0.24em] text-amber-50/90">
            {status === 'error' ? 'Scene unavailable' : 'Preparing scene'}
          </div>
        </div>
      )}
    </div>
  );
};
