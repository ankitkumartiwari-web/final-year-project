FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    git \
    build-essential \
    cmake \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN ln -s /usr/bin/python3 /usr/bin/python

WORKDIR /app

RUN python -m pip install --upgrade pip

# Install PyTorch CUDA 12 build
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# Install FAISS GPU
RUN pip install faiss-gpu

# Install embeddings + utilities
RUN pip install sentence-transformers numpy scipy tqdm

# Install llama-cpp CUDA (PREBUILT - FAST)
RUN pip install llama-cpp-python \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121

COPY . .

CMD ["python", "Ragimproved.py"]
