package main

import (
	"context"
	"log"

	"backend/src/app"
)

func main() {
	if err := app.Run(context.Background()); err != nil {
		log.Fatal(err)
	}
}
