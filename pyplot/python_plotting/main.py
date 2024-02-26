
from matplotlib import pyplot as plt
from visualizer import Visualizer

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

    for key in list(round_data[0].keys()):
        if key in ["_id", "pick"]:
            continue
    
        plt.figure(figsize=(16, 9))
        plt.gca().spines['bottom'].set_position('zero')
        plt.gca().spines['top'].set_position('zero')
        plt.gca().spines['right'].set_position('zero')
    
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        
        vis.plot_stat([d[key] * 100 for d in round_data], title=key, filename=key, isround=True, keys=[d["pick"] for d in round_data])
        
    unsorted_pick = list(vis.per_pick_stat_pct.find())
    pick_data = sorted(unsorted_pick, key=sort)

    for key in list(pick_data[0].keys()):
        if key in ["_id", "pick"]:
            continue
    
        plt.figure(figsize=(16, 9))
        plt.gca().spines['bottom'].set_position('zero')
        plt.gca().spines['top'].set_position('zero')
        plt.gca().spines['right'].set_position('zero')
    
        plt.gca().spines['top'].set_visible(False)
        plt.gca().spines['right'].set_visible(False)
        
        vis.plot_stat([d[key] * 100 for d in pick_data], title=key, filename=key, isround=False, keys=[d["pick"] for d in pick_data])