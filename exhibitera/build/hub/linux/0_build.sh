if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

if [ ! -d "$1" ]; then
  echo "Creating directory..."
  mkdir "$1"
fi


if [ ! -e "$1/venv/bin/activate" ]; then
  python3.13 -m venv "$1/venv/"
fi

rsync -a ../../../hub/* "$1/."

source 1_update_depends.sh
source 2_build_binary.sh