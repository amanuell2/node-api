#!/bin/bash

CLEAN="clean"
RUN="run"
STOP="stop"
DUMP="dump"
RESTORE="restore"
MONGO_SHELL="mongo"
LOGS="logs"
LOG_TO_FILE="log-to-file"
BUILD="build"

if [ -f .env ]
then
  export $(cat .env | sed 's/#.*//g' | xargs)
fi

if [ "$#" -eq 0 ] || [ $1 = "-h" ] || [ $1 = "--help" ]; then
    echo "Usage: ./ilift [OPTIONS] COMMAND [arg...]"
    echo "       ./ilift [ -h | --help ]"
    echo ""
    echo "Options:"
    echo "  -h, --help    Prints usage."
    echo ""
    echo "Commands:"
    echo "  $CLEAN        - Stop and Remove ilift server containers."
    echo "  $BUILD        - Build and Run ilift server."
    echo "  $RUN          - Run ilift server."
    echo "  $STOP         - Stop ilift server."
    echo "  $DUMP         - Dump the ilift database."
    echo "  $RESTORE      - Restore the ilift database from the dump."
    echo "  $MONGO_SHELL  - Spawn a mongo shell on the ilift database."
    echo "  $LOGS         - Show aggregated logs from containers"
    echo "  $LOG_TO_FILE  - Save aggregated logs from containers into a file"
    exit
fi

clean() {
  stop_existing
  remove_stopped_containers
  remove_unused_volumes
}

build() {
  echo "Cleaning..."
  # clean
  
  echo "Building and Running docker..."
  docker-compose up --build -d
}

run() {
  echo "Cleaning..."
  clean
  
  echo "Running docker..."
  docker-compose up -d
}

logs() {
  echo "Fetching logs..."
  docker-compose logs $1
}

log_to_file() {
  echo "Fetching logs and saving to $1"
  docker-compose logs > $1
}


restore_database() {
  input_file=$1

  docker exec -i ilift-mongo-refactored sh -c "mongorestore --gzip --nsInclude=ilift-db-latest.drivers -u ${DB_USERNAME} -p ${DB_PASSWORD} --authenticationDatabase admin --archive" < "$input_file";
  echo "Ilift database has been successfully been restored from ${input_file}";
}

dump_database() {
  output_file=$1;
  docker exec -t -i ilift-mongo sh -c "mongodump --db ilift-db-latest -u ${DB_USERNAME} -p ${DB_PASSWORD} --authenticationDatabase admin --archive" > "${output_file}";
  echo "Ilift database has been successfully dumped to ${output_file}"
}

spawn_database() {
  docker exec -it ilift-mongo-refactored mongo -u "${DB_USERNAME}" -p "${DB_PASSWORD}" --authenticationDatabase admin
  echo "Spawning a mongo shell on the ilift database"
}

stop_existing() {
  ilift="$(docker ps --all --quiet --filter=name=ilift)"
  REDIS="$(docker ps --all --quiet --filter=name=ilift-redis)"
  MONGO="$(docker ps --all --quiet --filter=name=ilift-mongo)"

  if [ -n "$ilift" ]; then
    docker stop $ilift
  fi

  if [ -n "$REDIS" ]; then
    docker stop $REDIS
  fi

  if [ -n "$MONGO" ]; then
    docker stop $MONGO
  fi
}

remove_stopped_containers() {
  CONTAINERS="$(docker ps -a -f status=exited -q)"
	if [ ${#CONTAINERS} -gt 0 ]; then
		echo "Removing all stopped containers."
		docker rm $CONTAINERS
	else
		echo "There are no stopped containers to be removed."
	fi
}

remove_unused_volumes() {
  CONTAINERS="$(docker volume ls -qf dangling=true)"
	if [ ${#CONTAINERS} -gt 0 ]; then
		echo "Removing all unused volumes."
		docker volume rm $CONTAINERS
	else
		echo "There are no unused volumes to be removed."
	fi
}

if [ $1 = $CLEAN ]; then
  echo "Cleaning..."
	clean
	exit
fi

if [ $1 = $RUN ]; then
	run
	exit
fi

if [ $1 = $STOP ]; then
	stop_existing
	exit
fi

if [ $1 = $DUMP ]; then
	dump_database $2
	exit
fi

if [ $1 = $RESTORE ]; then
	restore_database $2
	exit
fi

if [ $1 = $MONGO_SHELL ]; then
	spawn_database
	exit
fi

if [ $1 = $LOGS ]; then
	logs $2
	exit
fi

if [ $1 = $LOG_TO_FILE ]; then
	log_to_file $2
	exit
fi

if [ $1 = $BUILD ]; then
	build
	exit
fi