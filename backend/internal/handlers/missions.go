package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"amestris/backend/internal/db"
	"amestris/backend/internal/models"

	"github.com/gorilla/mux"
)

/* ===== DTOs de entrada (punteros para campos opcionales) ===== */
type missionCreateReq struct {
	Title               string  `json:"title"`
	Description         *string `json:"description"`
	Status              *string `json:"status"` // "OPEN", "IN_PROGRESS", "DONE"... ajusta a tu enum
	AssignedAlchemistID *uint   `json:"assignedAlchemistId"`
}

type missionUpdateReq struct {
	Title               *string `json:"title"`
	Description         *string `json:"description"`
	Status              *string `json:"status"`
	AssignedAlchemistID *uint   `json:"assignedAlchemistId"`
}

/* helper: desreferenciar punteros con default */
func val[T any](p *T, def T) T {
	if p != nil {
		return *p
	}
	return def
}

/* Normaliza el status string → models.MissionStatus (con default) */
func parseMissionStatus(p *string, def models.MissionStatus) models.MissionStatus {
	if p == nil {
		return def
	}
	s := strings.ToUpper(strings.TrimSpace(*p))
	if s == "" {
		return def
	}
	return models.MissionStatus(s)
}

/* =================== HANDLERS =================== */

func ListMissions(w http.ResponseWriter, r *http.Request) {
	var list []models.Mission
	if err := db.DB.Preload("AssignedAlchemist").Find(&list).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudieron listar las misiones")
		return
	}
	WriteJSON(w, http.StatusOK, list)
}

func GetMission(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var m models.Mission
	if err := db.DB.Preload("AssignedAlchemist").First(&m, id).Error; err != nil {
		WriteError(w, http.StatusNotFound, "misión no encontrada")
		return
	}
	WriteJSON(w, http.StatusOK, m)
}

func CreateMission(w http.ResponseWriter, r *http.Request) {
	var in missionCreateReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}

	title := strings.TrimSpace(in.Title)
	if title == "" {
		WriteError(w, http.StatusBadRequest, "title es requerido")
		return
	}

	// *string → string
	desc := val(in.Description, "")
	// string → models.MissionStatus (con default)
	status := parseMissionStatus(in.Status, models.MissionStatus("OPEN"))

	m := models.Mission{
		Title:               title,
		Description:         desc,
		Status:              status,
		AssignedAlchemistID: in.AssignedAlchemistID, // modelo acepta *uint
	}

	if err := db.DB.Create(&m).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo crear la misión")
		return
	}
	if err := db.DB.Preload("AssignedAlchemist").First(&m, m.ID).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "creada pero error al recargar")
		return
	}
	WriteJSON(w, http.StatusCreated, m)
}

func UpdateMission(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	var m models.Mission
	if err := db.DB.First(&m, id).Error; err != nil {
		WriteError(w, http.StatusNotFound, "misión no encontrada")
		return
	}

	var in missionUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteError(w, http.StatusBadRequest, "json inválido")
		return
	}

	if in.Title != nil {
		t := strings.TrimSpace(*in.Title)
		if t == "" {
			WriteError(w, http.StatusBadRequest, "title vacío")
			return
		}
		m.Title = t
	}
	if in.Description != nil {
		m.Description = *in.Description
	}
	if in.Status != nil {
		m.Status = parseMissionStatus(in.Status, m.Status)
	}
	if in.AssignedAlchemistID != nil {
		m.AssignedAlchemistID = in.AssignedAlchemistID
	}

	if err := db.DB.Save(&m).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo actualizar")
		return
	}
	if err := db.DB.Preload("AssignedAlchemist").First(&m, m.ID).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "actualizada pero error al recargar")
		return
	}
	WriteJSON(w, http.StatusOK, m)
}

func DeleteMission(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(mux.Vars(r)["id"])
	if err := db.DB.Delete(&models.Mission{}, id).Error; err != nil {
		WriteError(w, http.StatusInternalServerError, "no se pudo eliminar")
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
