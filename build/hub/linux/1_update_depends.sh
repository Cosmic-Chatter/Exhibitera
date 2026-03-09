if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

source "$1/venv/bin/activate" || exit 1
python3 -m pip install --upgrade pip
python3 -m pip install --upgrade -r "$1/exhibitera/hub/requirements.txt"
python3 -m pip install --upgrade pyinstaller
