package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"amestris/backend/internal/db"
	"amestris/backend/internal/models"

	"github.com/gorilla/mux"
)

func ListAlchemists(w http.ResponseWriter, r *http.Request) {
	var list []models.Alchemist
	if err := db.DB.Find(&list).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudieron listar los alchemists")
		return
	}
	WriteJSON(w, http.StatusOK, list)
}

func GetAlchemist(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var a models.Alchemist
	if err := db.DB.First(&a, id).Error; err != nil {
		WriteError(w, http.StatusNotFound, "alchemist no encontrado")
		return
	}
	WriteJSON(w, http.StatusOK, a)
}

func CreateAlchemist(w http.ResponseWriter, r *http.Request) {
	var in models.Alchemist
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}
	if in.Name == "" {
		WriteError(w, http.StatusBadRequest, "name es requerido")
		return
	}
	if err := db.DB.Create(&in).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo crear el alchemist")
		return
	}
	WriteJSON(w, http.StatusCreated, in)
}

func UpdateAlchemist(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var a models.Alchemist
	if err := db.DB.First(&a, id).Error; err != nil {
		WriteError(w, http.StatusNotFound, "alchemist no encontrado")
		return
	}
	var in models.Alchemist
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}
	a.Name = in.Name
	a.Rank = in.Rank
	a.Specialty = in.Specialty
	if err := db.DB.Save(&a).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo actualizar")
		return
	}
	WriteJSON(w, http.StatusOK, a)
}

func DeleteAlchemist(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	if err := db.DB.Delete(&models.Alchemist{}, id).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo eliminar")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
