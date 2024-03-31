
from visualizer import Visualizer

import json

def sort(item):
    try:
        val = int(item["pick"])
        return val
    except ValueError:
        if item["pick"] == "intl":
            return 3100
        return 3000

if __name__ == "__main__":        
    vis = Visualizer("./images/")
    unsorted_round = list(vis.per_round_stat_pct.find())
    round_data = sorted(unsorted_round, key=sort)
    
    unsorted_round_avg = list(vis.per_round_stat_avg.find())
    round_data_avg = sorted(unsorted_round_avg, key=sort)
    
    unsorted_pick = list(vis.per_pick_stat_pct.find())
    pick_data = sorted(unsorted_pick, key=sort)
    
    unsorted_pick_avg = list(vis.per_pick_stat_avg.find())
    pick_data_avg = sorted(unsorted_pick_avg, key=sort)
    
    #vis.plot_monetary_avg()
    #vis.plot_monetary(True)
    #vis.plot_monetary(False)
    
    for key in list(round_data_avg[0].keys()):
        if key in ["_id", "pick"]:
            continue
        
        vis.plot_stat([d[key] for d in round_data_avg], title=key, filename=key, isround=True, keys=[d["pick"] for d in round_data_avg], delta=False, avg=True)
        
        vis.plot_stat([d[key] for d in pick_data_avg], title=key, filename=key, isround=False, keys=[d["pick"] for d in pick_data_avg], delta=False, avg=True)
    
#    for key in list(round_data[0].keys()):
#        if key in ["_id", "pick"]:
#            continue
#        
#        vis.plot_stat([d[key] if key != "fldPct" else d[key] * 100 for d in round_data], title=key, filename=key, isround=True, keys=[d["pick"] for d in round_data], delta=False, avg=False)
#        
#        vis.plot_stat([d[key] if key != "fldPct" else d[key] * 100 for d in round_data], title=key, filename=key, isround=True, keys=[d["pick"] for d in round_data], delta=True, avg=False)
#        
#    for key in list(pick_data[0].keys()):
#        if key in ["_id", "pick"]:
#            continue
#        
#        vis.plot_stat([d[key] if key != "fldPct" else d[key] * 100 for d in pick_data], title=key, filename=key, isround=False, keys=[d["pick"] for d in pick_data], delta=False, avg=False)
        
