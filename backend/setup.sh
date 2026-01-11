#!/bin/bash

# TedTalks Backend Setup Script for macOS/Linux

echo ""
echo "========================================"
echo "TedTalks Backend Setup"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.8+ from https://www.python.org/"
    exit 1
fi

echo "✅ Python found!"
python3 --version

# Check if .env exists
if [ ! -f ".env" ]; then
    echo ""
    echo "Creating .env file from template..."
    cp .env.example .env
    echo ""
    echo "⚠️  Please edit .env with your MongoDB URI and configuration"
    echo ""
    read -p "Press Enter to continue..."
else
    echo "✅ .env file already exists"
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created!"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ ERROR: Failed to install dependencies"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "To start the server:"
echo "  1. Run: source venv/bin/activate"
echo "  2. Run: python main.py"
echo ""
echo "API Documentation: http://localhost:8000/docs"
echo ""
